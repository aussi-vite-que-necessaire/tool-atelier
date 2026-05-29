import { eq, and, asc, inArray } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, modules, resourceAccess } from "@/db/schema"
import { buildPageTree, type FlatPage, type TreePage } from "@/lib/content/tree"
import { resolvePageByPath } from "@/lib/content/resolve"
import { getPageModules } from "@/lib/content/queries"
import { extractSections } from "@/lib/content/toc"
import { moduleContentSchemas, type ModuleType } from "@/lib/modules/schemas"
import { normalizeEmail } from "@/lib/access"
import { buildTrackingUrl } from "@/lib/tracking/ref"
import { slugify, uniqueSlug } from "./slug"
import { planPages, type PageInput } from "./plan"
import type { ModuleInput } from "./module-input"

// Référence opérateur minimale : id (scoping data-layer) + handle (URLs publiques).
export type OpRef = { id: string; handle: string }

function appBaseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

export function resourceUrl(handle: string, slug: string): string {
  return `${appBaseUrl()}/o/${handle}/r/${slug}`
}

function pagePath(handle: string, slug: string, path: string[]): string {
  return `/o/${handle}/r/${slug}${path.length ? "/" + path.join("/") : ""}`
}

// Toute lecture/écriture de ressource est scopée par operator_id (ADR-0002).
async function getResourceRowBySlug(operatorId: string, slug: string) {
  const [r] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.slug, slug)))
    .limit(1)
  if (!r) throw new Error(`Ressource introuvable: ${slug}`)
  return r
}

async function flatPagesOf(resourceId: string): Promise<FlatPage[]> {
  const rows = await db.select().from(pages).where(eq(pages.resourceId, resourceId))
  return rows.map((p) => ({ id: p.id, parentId: p.parentId, slug: p.slug, title: p.title, position: p.position }))
}

async function resolve(operatorId: string, resourceSlug: string, path: string[]) {
  const resource = await getResourceRowBySlug(operatorId, resourceSlug)
  const root = buildPageTree(await flatPagesOf(resource.id))
  if (!root) throw new Error(`Ressource sans page racine: ${resourceSlug}`)
  const page = resolvePageByPath(root, path)
  if (!page) throw new Error(`Page introuvable: /${path.join("/")}`)
  return { resource, root, page }
}

// Vérifie que des modules appartiennent bien aux ressources de l'opérateur.
async function ownedModuleIds(operatorId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: modules.id })
    .from(modules)
    .innerJoin(pages, eq(pages.id, modules.pageId))
    .innerJoin(resources, eq(resources.id, pages.resourceId))
    .where(and(eq(resources.operatorId, operatorId), inArray(modules.id, ids)))
  return new Set(rows.map((r) => r.id))
}

// Vérifie que des pages appartiennent bien aux ressources de l'opérateur.
async function ownedPageIds(operatorId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(resources, eq(resources.id, pages.resourceId))
    .where(and(eq(resources.operatorId, operatorId), inArray(pages.id, ids)))
  return new Set(rows.map((r) => r.id))
}

// --- ressources ---
export async function listResources(operatorId: string) {
  return db
    .select({
      slug: resources.slug,
      title: resources.title,
      visibility: resources.visibility,
      published: resources.published,
      featured: resources.featured,
    })
    .from(resources)
    .where(eq(resources.operatorId, operatorId))
    .orderBy(asc(resources.title))
}

export async function createResource(
  op: OpRef,
  input: {
    slug?: string
    title: string
    description?: string
    visibility?: "public" | "private"
    featured?: boolean
    published?: boolean
    rootTitle?: string
    rootModules?: ModuleInput[]
    pages?: PageInput[]
  },
) {
  // Slug unique PARMI les ressources de cet opérateur.
  const existing = (
    await db.select({ slug: resources.slug }).from(resources).where(eq(resources.operatorId, op.id))
  ).map((r) => r.slug)
  const base = slugify(input.slug ?? input.title) || "ressource"
  const slug = uniqueSlug(base, existing)

  const [resource] = await db
    .insert(resources)
    .values({
      operatorId: op.id,
      slug,
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility ?? "public",
      featured: input.featured ?? false,
      published: input.published ?? false,
    })
    .returning()

  const planned = planPages(input.rootTitle ?? input.title, input.rootModules ?? [], input.pages ?? [])
  const idMap = new Map<string, string>()
  for (const p of planned) {
    const parentId = p.parentTempId ? idMap.get(p.parentTempId)! : null
    const [page] = await db
      .insert(pages)
      .values({ resourceId: resource.id, parentId, slug: p.slug, title: p.title, position: p.position })
      .returning()
    idMap.set(p.tempId, page.id)
    if (p.modules.length) {
      await db
        .insert(modules)
        .values(p.modules.map((m, i) => ({ pageId: page.id, type: m.type, position: i, content: m.content })))
    }
  }
  return { id: resource.id, slug: resource.slug, url: resourceUrl(op.handle, resource.slug) }
}

export async function updateResource(
  op: OpRef,
  slug: string,
  patch: {
    title?: string
    description?: string
    coverImageUrl?: string
    visibility?: "public" | "private"
    featured?: boolean
    published?: boolean
  },
) {
  const r = await getResourceRowBySlug(op.id, slug)
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  if (Object.keys(set).length) {
    await db
      .update(resources)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(resources.id, r.id))
  }
  return { slug: r.slug, url: resourceUrl(op.handle, r.slug) }
}

export async function deleteResource(operatorId: string, slug: string) {
  const r = await getResourceRowBySlug(operatorId, slug)
  await db.delete(resources).where(eq(resources.id, r.id))
  return { ok: true }
}

export async function getResource(op: OpRef, slug: string) {
  const r = await getResourceRowBySlug(op.id, slug)
  const root = buildPageTree(await flatPagesOf(r.id))
  if (!root) throw new Error(`Ressource sans page racine: ${slug}`)

  const toNode = async (node: TreePage, path: string[]): Promise<unknown> => {
    const mods = await getPageModules(node.id)
    const mdTexts = mods
      .filter((m) => m.type === "markdown" || m.type === "callout")
      .map((m) => (m.content as { md: string }).md)
    const sections = extractSections(mdTexts).map((s) => ({ ...s, href: `${pagePath(op.handle, r.slug, path)}#${s.anchor}` }))
    const children: unknown[] = []
    for (const c of node.children) children.push(await toNode(c, [...path, c.slug]))
    return {
      id: node.id,
      slug: node.slug,
      title: node.title,
      path,
      modules: mods.map((m) => ({ id: m.id, type: m.type, position: m.position, content: m.content })),
      sections,
      children,
    }
  }

  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    coverImageUrl: r.coverImageUrl,
    visibility: r.visibility,
    published: r.published,
    featured: r.featured,
    url: resourceUrl(op.handle, r.slug),
    root: await toNode(root, []),
  }
}

export async function getOutline(op: OpRef, slug: string) {
  const r = await getResourceRowBySlug(op.id, slug)
  const root = buildPageTree(await flatPagesOf(r.id))
  if (!root) throw new Error(`Ressource sans page racine: ${slug}`)

  const pages: {
    title: string
    path: string[]
    url: string
    sections: { title: string; anchor: string; href: string }[]
  }[] = []

  const walk = async (node: TreePage, path: string[]) => {
    const mods = await getPageModules(node.id)
    const mdTexts = mods
      .filter((m) => m.type === "markdown" || m.type === "callout")
      .map((m) => (m.content as { md: string }).md)
    const sections = extractSections(mdTexts).map((s) => ({
      title: s.title,
      anchor: s.anchor,
      href: `${pagePath(op.handle, r.slug, path)}#${s.anchor}`,
    }))
    pages.push({ title: node.title, path, url: pagePath(op.handle, r.slug, path), sections })
    for (const c of node.children) await walk(c, [...path, c.slug])
  }
  await walk(root, [])
  return { slug: r.slug, title: r.title, url: pagePath(op.handle, r.slug, []), pages }
}

export async function trackingLink(
  op: OpRef,
  input: {
    slug: string
    path?: string[]
    source: string
    medium?: string
    campaign?: string
  },
): Promise<{ url: string }> {
  await getResourceRowBySlug(op.id, input.slug) // valide l'existence + l'appartenance
  const base = `${appBaseUrl()}${pagePath(op.handle, input.slug, input.path ?? [])}`
  return { url: buildTrackingUrl(base, { source: input.source, medium: input.medium, campaign: input.campaign }) }
}

// --- pages ---
export async function addPage(
  operatorId: string,
  input: {
    resourceSlug: string
    parentPath?: string[]
    slug: string
    title: string
    position?: number
    modules?: ModuleInput[]
  },
) {
  const { resource, root } = await resolve(operatorId, input.resourceSlug, [])
  const parent = resolvePageByPath(root, input.parentPath ?? [])
  if (!parent) throw new Error(`Page parente introuvable: /${(input.parentPath ?? []).join("/")}`)
  const slug = slugify(input.slug) || input.slug
  const position = input.position ?? parent.children.length
  const [page] = await db
    .insert(pages)
    .values({ resourceId: resource.id, parentId: parent.id, slug, title: input.title, position })
    .returning()

  let moduleIds: string[] = []
  if (input.modules?.length) {
    const rows = await db
      .insert(modules)
      .values(input.modules.map((m, i) => ({ pageId: page.id, type: m.type, position: i, content: m.content })))
      .returning({ id: modules.id })
    moduleIds = rows.map((r) => r.id)
  }
  return { path: [...(input.parentPath ?? []), page.slug], moduleIds }
}

export async function addModules(
  operatorId: string,
  input: { resourceSlug: string; path: string[]; modules: ModuleInput[] },
) {
  const { page } = await resolve(operatorId, input.resourceSlug, input.path)
  const count = (await db.select({ id: modules.id }).from(modules).where(eq(modules.pageId, page.id))).length
  const rows = await db
    .insert(modules)
    .values(input.modules.map((m, i) => ({ pageId: page.id, type: m.type, position: count + i, content: m.content })))
    .returning({ id: modules.id })
  return { moduleIds: rows.map((r) => r.id) }
}

export async function updatePage(
  operatorId: string,
  input: {
    resourceSlug: string
    path: string[]
    patch: { title?: string; slug?: string }
  },
) {
  if (input.path.length === 0 && input.patch.slug !== undefined) {
    throw new Error("Le slug de la page racine ne peut pas changer.")
  }
  const { page } = await resolve(operatorId, input.resourceSlug, input.path)
  const set: Record<string, unknown> = {}
  if (input.patch.title !== undefined) set.title = input.patch.title
  if (input.patch.slug !== undefined) set.slug = slugify(input.patch.slug) || input.patch.slug
  if (Object.keys(set).length) {
    await db
      .update(pages)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(pages.id, page.id))
  }
  return { ok: true }
}

export async function deletePage(operatorId: string, input: { resourceSlug: string; path: string[] }) {
  if (input.path.length === 0) throw new Error("Impossible de supprimer la page racine.")
  const { page } = await resolve(operatorId, input.resourceSlug, input.path)
  await db.delete(pages).where(eq(pages.id, page.id))
  return { ok: true }
}

export async function movePage(
  operatorId: string,
  input: {
    resourceSlug: string
    path: string[]
    newParentPath?: string[]
    position?: number
  },
) {
  if (input.path.length === 0) throw new Error("Impossible de déplacer la page racine.")
  const { root, page } = await resolve(operatorId, input.resourceSlug, input.path)
  const newParent = resolvePageByPath(root, input.newParentPath ?? [])
  if (!newParent) throw new Error(`Nouveau parent introuvable: /${(input.newParentPath ?? []).join("/")}`)
  const banned = new Set<string>()
  const collect = (n: TreePage) => {
    banned.add(n.id)
    n.children.forEach(collect)
  }
  collect(page)
  if (banned.has(newParent.id)) throw new Error("Déplacement impossible : créerait un cycle.")
  const position = input.position ?? newParent.children.length
  await db
    .update(pages)
    .set({ parentId: newParent.id, position, updatedAt: new Date() })
    .where(eq(pages.id, page.id))
  return { ok: true }
}

// --- modules ---
export async function addModule(
  operatorId: string,
  input: {
    resourceSlug: string
    path: string[]
    module: ModuleInput
    position?: number
  },
) {
  const { page } = await resolve(operatorId, input.resourceSlug, input.path)
  const count = (await db.select({ id: modules.id }).from(modules).where(eq(modules.pageId, page.id))).length
  const position = input.position ?? count
  const [m] = await db
    .insert(modules)
    .values({ pageId: page.id, type: input.module.type, position, content: input.module.content })
    .returning()
  return { id: m.id }
}

export async function updateModule(
  operatorId: string,
  input: { id: string; content?: unknown; position?: number },
) {
  const owned = await ownedModuleIds(operatorId, [input.id])
  if (!owned.has(input.id)) throw new Error(`Module introuvable: ${input.id}`)
  const [m] = await db.select().from(modules).where(eq(modules.id, input.id)).limit(1)
  if (!m) throw new Error(`Module introuvable: ${input.id}`)
  const set: Record<string, unknown> = {}
  if (input.content !== undefined) {
    const schema = moduleContentSchemas[m.type as ModuleType]
    if (!schema) throw new Error(`Type de module inconnu: ${m.type}`)
    set.content = schema.parse(input.content)
  }
  if (input.position !== undefined) set.position = input.position
  if (Object.keys(set).length) {
    await db
      .update(modules)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(modules.id, m.id))
  }
  return { ok: true }
}

export async function deleteModule(operatorId: string, input: { id: string }) {
  const owned = await ownedModuleIds(operatorId, [input.id])
  if (!owned.has(input.id)) throw new Error(`Module introuvable: ${input.id}`)
  await db.delete(modules).where(eq(modules.id, input.id))
  return { ok: true }
}

export async function reorderModules(operatorId: string, input: { orderedModuleIds: string[] }) {
  const owned = await ownedModuleIds(operatorId, input.orderedModuleIds)
  for (let i = 0; i < input.orderedModuleIds.length; i++) {
    const id = input.orderedModuleIds[i]
    if (!owned.has(id)) continue // ignore tout id hors périmètre opérateur
    await db
      .update(modules)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(modules.id, id))
  }
  return { ok: true }
}

// --- accès privé ---
export async function grantAccess(operatorId: string, input: { resourceSlug: string; email: string }) {
  const r = await getResourceRowBySlug(operatorId, input.resourceSlug)
  await db.insert(resourceAccess).values({ resourceId: r.id, email: normalizeEmail(input.email) }).onConflictDoNothing()
  return { ok: true }
}

export async function revokeAccess(operatorId: string, input: { resourceSlug: string; email: string }) {
  const r = await getResourceRowBySlug(operatorId, input.resourceSlug)
  await db
    .delete(resourceAccess)
    .where(and(eq(resourceAccess.resourceId, r.id), eq(resourceAccess.email, normalizeEmail(input.email))))
  return { ok: true }
}

export async function listAccess(operatorId: string, resourceSlug: string): Promise<string[]> {
  const r = await getResourceRowBySlug(operatorId, resourceSlug)
  const rows = await db
    .select({ email: resourceAccess.email })
    .from(resourceAccess)
    .where(eq(resourceAccess.resourceId, r.id))
  return rows.map((x) => x.email)
}

export async function reorderPages(operatorId: string, orderedChildIds: string[]) {
  const owned = await ownedPageIds(operatorId, orderedChildIds)
  for (let i = 0; i < orderedChildIds.length; i++) {
    const id = orderedChildIds[i]
    if (!owned.has(id)) continue
    await db
      .update(pages)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(pages.id, id))
  }
  return { ok: true }
}
