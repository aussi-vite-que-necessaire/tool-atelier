import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { resAccess, resModules, resPages, resResources } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { normalizeEmail } from './access';
import type { ModuleInput } from './module-input';
import { type ModuleType, moduleContentSchemas } from './module-schemas';
import { type PageInput, planPages } from './plan';
import { resolvePageByPath } from './resolve';
import type { OpRef } from './settings';
import { slugify, uniqueSlug } from './slug';
import { extractSections } from './toc';
import { buildTrackingUrl } from './tracking';
import { buildPageTree, type FlatPage, type TreePage } from './tree';

export type { OpRef } from './settings';

function appBaseUrl(): string {
  return (env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function resourceUrl(handle: string, slug: string): string {
  return `${appBaseUrl()}/docs/${handle}/r/${slug}`;
}

function pagePath(handle: string, slug: string, path: string[]): string {
  return `/docs/${handle}/r/${slug}${path.length ? `/${path.join('/')}` : ''}`;
}

// Toute lecture/écriture de ressource est scopée par user_id.
async function getResourceRowBySlug(userId: string, slug: string) {
  const [r] = await db
    .select()
    .from(resResources)
    .where(and(eq(resResources.userId, userId), eq(resResources.slug, slug)))
    .limit(1);
  if (!r) throw new Error(`Ressource introuvable: ${slug}`);
  return r;
}

async function flatPagesOf(resourceId: string): Promise<FlatPage[]> {
  const rows = await db.select().from(resPages).where(eq(resPages.resourceId, resourceId));
  return rows.map((p) => ({
    id: p.id,
    parentId: p.parentId,
    slug: p.slug,
    title: p.title,
    position: p.position,
  }));
}

async function resolve(userId: string, resourceSlug: string, path: string[]) {
  const resource = await getResourceRowBySlug(userId, resourceSlug);
  const root = buildPageTree(await flatPagesOf(resource.id));
  if (!root) throw new Error(`Ressource sans page racine: ${resourceSlug}`);
  const page = resolvePageByPath(root, path);
  if (!page) throw new Error(`Page introuvable: /${path.join('/')}`);
  return { resource, root, page };
}

async function ownedModuleIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: resModules.id })
    .from(resModules)
    .innerJoin(resPages, eq(resPages.id, resModules.pageId))
    .innerJoin(resResources, eq(resResources.id, resPages.resourceId))
    .where(and(eq(resResources.userId, userId), inArray(resModules.id, ids)));
  return new Set(rows.map((r) => r.id));
}

async function ownedPageIds(userId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: resPages.id })
    .from(resPages)
    .innerJoin(resResources, eq(resResources.id, resPages.resourceId))
    .where(and(eq(resResources.userId, userId), inArray(resPages.id, ids)));
  return new Set(rows.map((r) => r.id));
}

// --- ressources ---
export async function listResources(userId: string) {
  return db
    .select({
      slug: resResources.slug,
      title: resResources.title,
      visibility: resResources.visibility,
      published: resResources.published,
      featured: resResources.featured,
    })
    .from(resResources)
    .where(eq(resResources.userId, userId))
    .orderBy(asc(resResources.title));
}

export async function createResource(
  op: OpRef,
  input: {
    slug?: string;
    title: string;
    description?: string;
    visibility?: 'public' | 'private';
    featured?: boolean;
    published?: boolean;
    rootTitle?: string;
    rootModules?: ModuleInput[];
    pages?: PageInput[];
  },
) {
  const existing = (
    await db
      .select({ slug: resResources.slug })
      .from(resResources)
      .where(eq(resResources.userId, op.id))
  ).map((r) => r.slug);
  const base = slugify(input.slug ?? input.title) || 'ressource';
  const slug = uniqueSlug(base, existing);

  const [resource] = await db
    .insert(resResources)
    .values({
      userId: op.id,
      slug,
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility ?? 'public',
      featured: input.featured ?? false,
      published: input.published ?? false,
    })
    .returning();

  const planned = planPages(
    input.rootTitle ?? input.title,
    input.rootModules ?? [],
    input.pages ?? [],
  );
  const idMap = new Map<string, string>();
  for (const p of planned) {
    const parentId = p.parentTempId ? idMap.get(p.parentTempId)! : null;
    const [page] = await db
      .insert(resPages)
      .values({
        resourceId: resource!.id,
        parentId,
        slug: p.slug,
        title: p.title,
        position: p.position,
      })
      .returning();
    idMap.set(p.tempId, page!.id);
    if (p.modules.length) {
      await db.insert(resModules).values(
        p.modules.map((m, i) => ({
          pageId: page!.id,
          type: m.type,
          position: i,
          content: m.content,
        })),
      );
    }
  }
  return { id: resource!.id, slug: resource!.slug, url: resourceUrl(op.handle, resource!.slug) };
}

export async function updateResource(
  op: OpRef,
  slug: string,
  patch: {
    title?: string;
    description?: string;
    coverImageUrl?: string;
    visibility?: 'public' | 'private';
    featured?: boolean;
    published?: boolean;
  },
) {
  const r = await getResourceRowBySlug(op.id, slug);
  const set = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (Object.keys(set).length) {
    await db
      .update(resResources)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(resResources.id, r.id));
  }
  return { slug: r.slug, url: resourceUrl(op.handle, r.slug) };
}

export async function deleteResource(userId: string, slug: string) {
  const r = await getResourceRowBySlug(userId, slug);
  await db.delete(resResources).where(eq(resResources.id, r.id));
  return { ok: true };
}

export async function getResource(op: OpRef, slug: string) {
  const r = await getResourceRowBySlug(op.id, slug);
  const root = buildPageTree(await flatPagesOf(r.id));
  if (!root) throw new Error(`Ressource sans page racine: ${slug}`);

  const toNode = async (node: TreePage, path: string[]): Promise<unknown> => {
    const mods = await getModulesForPage(node.id);
    const mdTexts = mods
      .filter((m) => m.type === 'markdown' || m.type === 'callout')
      .map((m) => (m.content as { md: string }).md);
    const sections = extractSections(mdTexts).map((s) => ({
      ...s,
      href: `${pagePath(op.handle, r.slug, path)}#${s.anchor}`,
    }));
    const children: unknown[] = [];
    for (const c of node.children) children.push(await toNode(c, [...path, c.slug]));
    return {
      id: node.id,
      slug: node.slug,
      title: node.title,
      path,
      modules: mods.map((m) => ({
        id: m.id,
        type: m.type,
        position: m.position,
        content: m.content,
      })),
      sections,
      children,
    };
  };

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
  };
}

async function getModulesForPage(pageId: string) {
  const rows = await db
    .select()
    .from(resModules)
    .where(eq(resModules.pageId, pageId))
    .orderBy(asc(resModules.position));
  return rows.map((r) => ({ id: r.id, type: r.type, position: r.position, content: r.content }));
}

export async function getOutline(op: OpRef, slug: string) {
  const r = await getResourceRowBySlug(op.id, slug);
  const root = buildPageTree(await flatPagesOf(r.id));
  if (!root) throw new Error(`Ressource sans page racine: ${slug}`);

  const pagesOut: {
    title: string;
    path: string[];
    url: string;
    sections: { title: string; anchor: string; href: string }[];
  }[] = [];

  const walk = async (node: TreePage, path: string[]) => {
    const mods = await getModulesForPage(node.id);
    const mdTexts = mods
      .filter((m) => m.type === 'markdown' || m.type === 'callout')
      .map((m) => (m.content as { md: string }).md);
    const sections = extractSections(mdTexts).map((s) => ({
      title: s.title,
      anchor: s.anchor,
      href: `${pagePath(op.handle, r.slug, path)}#${s.anchor}`,
    }));
    pagesOut.push({
      title: node.title,
      path,
      url: pagePath(op.handle, r.slug, path),
      sections,
    });
    for (const c of node.children) await walk(c, [...path, c.slug]);
  };
  await walk(root, []);
  return { slug: r.slug, title: r.title, url: pagePath(op.handle, r.slug, []), pages: pagesOut };
}

export async function trackingLink(
  op: OpRef,
  input: { slug: string; path?: string[]; source: string; medium?: string; campaign?: string },
): Promise<{ url: string }> {
  await getResourceRowBySlug(op.id, input.slug);
  const base = `${appBaseUrl()}${pagePath(op.handle, input.slug, input.path ?? [])}`;
  return {
    url: buildTrackingUrl(base, {
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
    }),
  };
}

// --- pages ---
export async function addPage(
  userId: string,
  input: {
    resourceSlug: string;
    parentPath?: string[];
    slug: string;
    title: string;
    position?: number;
    modules?: ModuleInput[];
  },
) {
  const { resource, root } = await resolve(userId, input.resourceSlug, []);
  const parent = resolvePageByPath(root, input.parentPath ?? []);
  if (!parent) throw new Error(`Page parente introuvable: /${(input.parentPath ?? []).join('/')}`);
  const slug = slugify(input.slug) || input.slug;
  const position = input.position ?? parent.children.length;
  const [page] = await db
    .insert(resPages)
    .values({ resourceId: resource.id, parentId: parent.id, slug, title: input.title, position })
    .returning();

  let moduleIds: string[] = [];
  if (input.modules?.length) {
    const rows = await db
      .insert(resModules)
      .values(
        input.modules.map((m, i) => ({
          pageId: page!.id,
          type: m.type,
          position: i,
          content: m.content,
        })),
      )
      .returning({ id: resModules.id });
    moduleIds = rows.map((r) => r.id);
  }
  return { path: [...(input.parentPath ?? []), page!.slug], moduleIds };
}

export async function addModules(
  userId: string,
  input: { resourceSlug: string; path: string[]; modules: ModuleInput[] },
) {
  const { page } = await resolve(userId, input.resourceSlug, input.path);
  const count = (
    await db.select({ id: resModules.id }).from(resModules).where(eq(resModules.pageId, page.id))
  ).length;
  const rows = await db
    .insert(resModules)
    .values(
      input.modules.map((m, i) => ({
        pageId: page.id,
        type: m.type,
        position: count + i,
        content: m.content,
      })),
    )
    .returning({ id: resModules.id });
  return { moduleIds: rows.map((r) => r.id) };
}

export async function updatePage(
  userId: string,
  input: { resourceSlug: string; path: string[]; patch: { title?: string; slug?: string } },
) {
  if (input.path.length === 0 && input.patch.slug !== undefined) {
    throw new Error('Le slug de la page racine ne peut pas changer.');
  }
  const { page } = await resolve(userId, input.resourceSlug, input.path);
  const set: Record<string, unknown> = {};
  if (input.patch.title !== undefined) set.title = input.patch.title;
  if (input.patch.slug !== undefined) set.slug = slugify(input.patch.slug) || input.patch.slug;
  if (Object.keys(set).length) {
    await db
      .update(resPages)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(resPages.id, page.id));
  }
  return { ok: true };
}

export async function deletePage(userId: string, input: { resourceSlug: string; path: string[] }) {
  if (input.path.length === 0) throw new Error('Impossible de supprimer la page racine.');
  const { page } = await resolve(userId, input.resourceSlug, input.path);
  await db.delete(resPages).where(eq(resPages.id, page.id));
  return { ok: true };
}

export async function movePage(
  userId: string,
  input: { resourceSlug: string; path: string[]; newParentPath?: string[]; position?: number },
) {
  if (input.path.length === 0) throw new Error('Impossible de déplacer la page racine.');
  const { root, page } = await resolve(userId, input.resourceSlug, input.path);
  const newParent = resolvePageByPath(root, input.newParentPath ?? []);
  if (!newParent)
    throw new Error(`Nouveau parent introuvable: /${(input.newParentPath ?? []).join('/')}`);
  const banned = new Set<string>();
  const collect = (n: TreePage) => {
    banned.add(n.id);
    n.children.forEach(collect);
  };
  collect(page);
  if (banned.has(newParent.id)) throw new Error('Déplacement impossible : créerait un cycle.');
  const position = input.position ?? newParent.children.length;
  await db
    .update(resPages)
    .set({ parentId: newParent.id, position, updatedAt: new Date() })
    .where(eq(resPages.id, page.id));
  return { ok: true };
}

// --- modules ---
export async function addModule(
  userId: string,
  input: { resourceSlug: string; path: string[]; module: ModuleInput; position?: number },
) {
  const { page } = await resolve(userId, input.resourceSlug, input.path);
  const count = (
    await db.select({ id: resModules.id }).from(resModules).where(eq(resModules.pageId, page.id))
  ).length;
  const position = input.position ?? count;
  const [m] = await db
    .insert(resModules)
    .values({
      pageId: page.id,
      type: input.module.type,
      position,
      content: input.module.content,
    })
    .returning();
  return { id: m!.id };
}

export async function updateModule(
  userId: string,
  input: { id: string; content?: unknown; position?: number },
) {
  const owned = await ownedModuleIds(userId, [input.id]);
  if (!owned.has(input.id)) throw new Error(`Module introuvable: ${input.id}`);
  const [m] = await db.select().from(resModules).where(eq(resModules.id, input.id)).limit(1);
  if (!m) throw new Error(`Module introuvable: ${input.id}`);
  const set: Record<string, unknown> = {};
  if (input.content !== undefined) {
    const schema = moduleContentSchemas[m.type as ModuleType];
    if (!schema) throw new Error(`Type de module inconnu: ${m.type}`);
    set.content = schema.parse(input.content);
  }
  if (input.position !== undefined) set.position = input.position;
  if (Object.keys(set).length) {
    await db
      .update(resModules)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(resModules.id, m.id));
  }
  return { ok: true };
}

export async function deleteModule(userId: string, input: { id: string }) {
  const owned = await ownedModuleIds(userId, [input.id]);
  if (!owned.has(input.id)) throw new Error(`Module introuvable: ${input.id}`);
  await db.delete(resModules).where(eq(resModules.id, input.id));
  return { ok: true };
}

export async function reorderModules(userId: string, input: { orderedModuleIds: string[] }) {
  const owned = await ownedModuleIds(userId, input.orderedModuleIds);
  for (let i = 0; i < input.orderedModuleIds.length; i++) {
    const id = input.orderedModuleIds[i]!;
    if (!owned.has(id)) continue;
    await db
      .update(resModules)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(resModules.id, id));
  }
  return { ok: true };
}

// --- accès privé ---
export async function grantAccess(userId: string, input: { resourceSlug: string; email: string }) {
  const r = await getResourceRowBySlug(userId, input.resourceSlug);
  await db
    .insert(resAccess)
    .values({ resourceId: r.id, email: normalizeEmail(input.email) })
    .onConflictDoNothing();
  return { ok: true };
}

export async function revokeAccess(userId: string, input: { resourceSlug: string; email: string }) {
  const r = await getResourceRowBySlug(userId, input.resourceSlug);
  await db
    .delete(resAccess)
    .where(and(eq(resAccess.resourceId, r.id), eq(resAccess.email, normalizeEmail(input.email))));
  return { ok: true };
}

export async function listAccess(userId: string, resourceSlug: string): Promise<string[]> {
  const r = await getResourceRowBySlug(userId, resourceSlug);
  const rows = await db
    .select({ email: resAccess.email })
    .from(resAccess)
    .where(eq(resAccess.resourceId, r.id));
  return rows.map((x) => x.email);
}

export async function reorderPages(userId: string, orderedChildIds: string[]) {
  const owned = await ownedPageIds(userId, orderedChildIds);
  for (let i = 0; i < orderedChildIds.length; i++) {
    const id = orderedChildIds[i]!;
    if (!owned.has(id)) continue;
    await db
      .update(resPages)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(resPages.id, id));
  }
  return { ok: true };
}
