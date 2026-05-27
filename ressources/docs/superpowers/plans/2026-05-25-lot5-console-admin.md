# Lot 5 — Console d'administration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une zone `/admin` protégée par flag admin où Manu gère ses ressources (métadonnées, publication, featured, visibilité, accès privé), édite l'arbre de pages et les modules par formulaires, et consulte les stats.

**Architecture:** Flag `is_admin` sur `user` (exposé via better-auth), garde `requireAdmin`. Server Components + server actions qui délèguent à la couche service (lot 3) et aux requêtes stats (lot 4). Réordonnancement ↑↓ via un utilitaire pur `moveInList` + les fonctions de réordonnancement du service. Un seul composant client (`ModuleForm`) pour l'édition typée des modules.

**Tech Stack:** Next 16 (App Router, server actions), better-auth, Drizzle, Zod, Vitest.

---

## Structure des fichiers

```
db/schema/auth.ts                          + colonne is_admin
lib/auth.ts                                + additionalField isAdmin
db/make-admin.ts                           script bootstrap admin
package.json                               + script db:make-admin
lib/admin/guard.ts                         requireAdmin()
lib/admin/reorder.ts                       moveInList (pur)
lib/admin/reorder.test.ts
lib/admin/module-content.ts                buildModuleContent (pur)
lib/admin/module-content.test.ts
lib/resources/service.ts                   + reorderPages + coverImageUrl dans getResource
lib/actions/admin.ts                       server actions admin
app/admin/layout.tsx                       garde + nav
app/admin/page.tsx                         dashboard
app/admin/r/[slug]/page.tsx                éditeur ressource
app/admin/r/[slug]/p/[...path]/page.tsx    éditeur de page (modules)
components/admin/page-tree-editor.tsx      arbre éditable (server)
components/admin/module-form.tsx           formulaire module typé (client)
```

---

## Task 1: Flag admin + bootstrap

**Files:** Modify `db/schema/auth.ts`, `lib/auth.ts`, `package.json` ; Create `db/make-admin.ts`

- [ ] **Step 1: Ajouter la colonne dans `db/schema/auth.ts`** (table `user`, après `emailVerified`)

```ts
  emailVerified: boolean("email_verified").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
```

- [ ] **Step 2: Déclarer le champ dans `lib/auth.ts`** (ajouter la clé `user` à l'objet `betterAuth`, avant `plugins`)

```ts
  user: {
    additionalFields: {
      isAdmin: { type: "boolean", input: false, defaultValue: false },
    },
  },
```

- [ ] **Step 3: Créer `db/make-admin.ts`** (imports relatifs, pour tsx)

```ts
import { eq } from "drizzle-orm"
import { db } from "./index"
import { user } from "./schema"

const email = process.argv[2]
if (!email) {
  console.error("Usage: db:make-admin <email>")
  process.exit(1)
}

const res = await db.update(user).set({ isAdmin: true }).where(eq(user.email, email.toLowerCase())).returning()
if (res.length === 0) console.error(`Aucun utilisateur avec l'email ${email} (il doit s'être connecté au moins une fois).`)
else console.log(`Admin activé pour ${email}.`)
process.exit(0)
```

- [ ] **Step 4: Ajouter le script dans `package.json`** (bloc `scripts`)

```json
    "db:make-admin": "node --env-file=.env.local --import tsx db/make-admin.ts",
```

- [ ] **Step 5: Pousser le schéma + typecheck**

Run : `npm run db:push && npm run typecheck`
Expected : colonne `is_admin` ajoutée ; aucune erreur de type.

- [ ] **Step 6: Commit**

```bash
git add db/schema/auth.ts lib/auth.ts db/make-admin.ts package.json
git commit -m "feat: flag is_admin + script de bootstrap admin"
```

---

## Task 2: Garde admin

**Files:** Create `lib/admin/guard.ts`

- [ ] **Step 1: Écrire `lib/admin/guard.ts`**

```ts
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(session.user as { isAdmin?: boolean }).isAdmin) {
    redirect("/connexion")
  }
  return session
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/admin/guard.ts
git commit -m "feat: garde requireAdmin"
```

---

## Task 3: Réordonnancement (TDD)

**Files:** Create `lib/admin/reorder.ts`, `lib/admin/reorder.test.ts`

- [ ] **Step 1: Écrire `lib/admin/reorder.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { moveInList } from "./reorder"

describe("moveInList", () => {
  it("monte un élément", () => {
    expect(moveInList(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"])
  })
  it("descend un élément", () => {
    expect(moveInList(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"])
  })
  it("ne monte pas le premier", () => {
    expect(moveInList(["a", "b"], "a", "up")).toEqual(["a", "b"])
  })
  it("ne descend pas le dernier", () => {
    expect(moveInList(["a", "b"], "b", "down")).toEqual(["a", "b"])
  })
  it("ignore un id absent", () => {
    expect(moveInList(["a", "b"], "x", "up")).toEqual(["a", "b"])
  })
})
```

- [ ] **Step 2: Lancer (échec attendu)**

Run : `npx vitest run lib/admin/reorder.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/admin/reorder.ts`**

```ts
export function moveInList(ids: string[], id: string, direction: "up" | "down"): string[] {
  const i = ids.indexOf(id)
  if (i === -1) return ids
  const j = direction === "up" ? i - 1 : i + 1
  if (j < 0 || j >= ids.length) return ids
  const out = [...ids]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}
```

- [ ] **Step 4: Lancer (succès) + commit**

Run : `npx vitest run lib/admin/reorder.test.ts`
Expected : PASS.

```bash
git add lib/admin/reorder.ts lib/admin/reorder.test.ts
git commit -m "feat: moveInList (réordonnancement ↑↓)"
```

---

## Task 4: Construction du contenu de module (TDD)

**Files:** Create `lib/admin/module-content.ts`, `lib/admin/module-content.test.ts`

- [ ] **Step 1: Écrire `lib/admin/module-content.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buildModuleContent } from "./module-content"

describe("buildModuleContent", () => {
  it("markdown depuis le champ md", () => {
    expect(buildModuleContent("markdown", { md: "# Hi" })).toEqual({ type: "markdown", content: { md: "# Hi" } })
  })
  it("callout avec variante", () => {
    expect(buildModuleContent("callout", { md: "x", variant: "warn" })).toEqual({
      type: "callout",
      content: { variant: "warn", md: "x" },
    })
  })
  it("image : ignore les champs optionnels vides", () => {
    expect(buildModuleContent("image", { url: "https://r2.example/x.png", alt: "", caption: "" })).toEqual({
      type: "image",
      content: { url: "https://r2.example/x.png" },
    })
  })
  it("file avec taille numérique", () => {
    const m = buildModuleContent("file", { url: "https://r2.example/x.zip", label: "DL", filename: "x.zip", size: "2048" })
    expect(m).toEqual({ type: "file", content: { url: "https://r2.example/x.zip", label: "DL", filename: "x.zip", size: 2048 } })
  })
  it("rejette une URL invalide", () => {
    expect(() => buildModuleContent("image", { url: "pas-une-url" })).toThrow()
  })
})
```

- [ ] **Step 2: Lancer (échec attendu)**

Run : `npx vitest run lib/admin/module-content.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/admin/module-content.ts`**

```ts
import { moduleInputSchema, type ModuleInput } from "@/lib/resources/module-input"

type Fields = Record<string, string | undefined>

function clean(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""))
}

export function buildModuleContent(type: string, fields: Fields): ModuleInput {
  let content: unknown
  switch (type) {
    case "markdown":
      content = { md: fields.md ?? "" }
      break
    case "callout":
      content = { variant: fields.variant ?? "info", md: fields.md ?? "" }
      break
    case "image":
      content = clean({ url: fields.url, alt: fields.alt, caption: fields.caption })
      break
    case "video":
      content = clean({ url: fields.url, caption: fields.caption })
      break
    case "file":
      content = clean({
        url: fields.url,
        label: fields.label,
        filename: fields.filename,
        size: fields.size ? Number(fields.size) : undefined,
      })
      break
    case "embed":
      content = clean({ url: fields.url })
      break
    default:
      content = {}
  }
  return moduleInputSchema.parse({ type, content })
}
```

- [ ] **Step 4: Lancer (succès) + commit**

Run : `npm test`
Expected : tout PASS.

```bash
git add lib/admin/module-content.ts lib/admin/module-content.test.ts
git commit -m "feat: buildModuleContent (formulaire → module validé)"
```

---

## Task 5: Compléments couche service

**Files:** Modify `lib/resources/service.ts`

- [ ] **Step 1: Ajouter `coverImageUrl` au retour de `getResource`** (dans l'objet retourné par `getResource`, après `description`)

```ts
    description: r.description,
    coverImageUrl: r.coverImageUrl,
```

- [ ] **Step 2: Ajouter `reorderPages`** à la fin de `lib/resources/service.ts`

```ts
export async function reorderPages(orderedChildIds: string[]) {
  for (let i = 0; i < orderedChildIds.length; i++) {
    await db
      .update(pages)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(pages.id, orderedChildIds[i]))
  }
  return { ok: true }
}
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/resources/service.ts
git commit -m "feat: reorderPages + coverImageUrl dans getResource"
```

---

## Task 6: Server actions admin

**Files:** Create `lib/actions/admin.ts`

- [ ] **Step 1: Écrire `lib/actions/admin.ts`**

```ts
"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/guard"
import { moveInList } from "@/lib/admin/reorder"
import { buildModuleContent } from "@/lib/admin/module-content"
import * as service from "@/lib/resources/service"

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key)
  return v == null ? undefined : String(v)
}
function parsePath(s: string | undefined): string[] {
  return s ? s.split("/").filter(Boolean) : []
}
function revalidateResource(slug: string) {
  revalidatePath("/admin")
  revalidatePath(`/admin/r/${slug}`, "layout")
}

export async function createResourceAction(fd: FormData) {
  await requireAdmin()
  const title = str(fd, "title") ?? "Nouvelle ressource"
  const { slug } = await service.createResource({ title })
  redirect(`/admin/r/${slug}`)
}

export async function updateResourceMetaAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "slug")!
  await service.updateResource(slug, {
    title: str(fd, "title"),
    description: str(fd, "description"),
    coverImageUrl: str(fd, "coverImageUrl"),
    visibility: (str(fd, "visibility") as "public" | "private") ?? undefined,
    published: fd.get("published") === "on",
    featured: fd.get("featured") === "on",
  })
  revalidateResource(slug)
}

export async function deleteResourceAction(fd: FormData) {
  await requireAdmin()
  await service.deleteResource(str(fd, "slug")!)
  revalidatePath("/admin")
  redirect("/admin")
}

export async function addPageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.addPage({
    resourceSlug: slug,
    parentPath: parsePath(str(fd, "parentPath")),
    slug: str(fd, "slug") ?? "page",
    title: str(fd, "title") ?? "Page",
  })
  revalidateResource(slug)
}

export async function renamePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.updatePage({
    resourceSlug: slug,
    path: parsePath(str(fd, "path")),
    patch: { title: str(fd, "title"), slug: str(fd, "slug") || undefined },
  })
  revalidateResource(slug)
}

export async function deletePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.deletePage({ resourceSlug: slug, path: parsePath(str(fd, "path")) })
  revalidateResource(slug)
}

export async function movePageAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const ids = (str(fd, "orderedIds") ?? "").split(",").filter(Boolean)
  const reordered = moveInList(ids, str(fd, "id")!, str(fd, "direction") as "up" | "down")
  await service.reorderPages(reordered)
  revalidateResource(slug)
}

export async function addModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.addModule({
    resourceSlug: slug,
    path: parsePath(str(fd, "path")),
    module: buildModuleContent(str(fd, "type")!, Object.fromEntries(fd.entries()) as Record<string, string>),
  })
  revalidateResource(slug)
}

export async function updateModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const built = buildModuleContent(str(fd, "type")!, Object.fromEntries(fd.entries()) as Record<string, string>)
  await service.updateModule({ id: str(fd, "id")!, content: built.content })
  revalidateResource(slug)
}

export async function deleteModuleAction(fd: FormData) {
  await requireAdmin()
  await service.deleteModule({ id: str(fd, "id")! })
  revalidateResource(str(fd, "resourceSlug")!)
}

export async function moveModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const ids = (str(fd, "orderedIds") ?? "").split(",").filter(Boolean)
  const reordered = moveInList(ids, str(fd, "id")!, str(fd, "direction") as "up" | "down")
  await service.reorderModules({ orderedModuleIds: reordered })
  revalidateResource(slug)
}

export async function grantAccessAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.grantAccess({ resourceSlug: slug, email: str(fd, "email")! })
  revalidateResource(slug)
}

export async function revokeAccessAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  await service.revokeAccess({ resourceSlug: slug, email: str(fd, "email")! })
  revalidateResource(slug)
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/actions/admin.ts
git commit -m "feat: server actions admin (ressources, pages, modules, accès)"
```

---

## Task 7: Layout + dashboard

**Files:** Create `app/admin/layout.tsx`, `app/admin/page.tsx`

- [ ] **Step 1: Écrire `app/admin/layout.tsx`**

```tsx
import Link from "next/link"
import { requireAdmin } from "@/lib/admin/guard"
import { signOutAction } from "@/lib/actions/library"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b-4 border-foreground px-6 py-3">
        <nav className="flex gap-4 text-xs font-extrabold uppercase tracking-widest">
          <Link href="/admin">Admin</Link>
          <Link href="/">Site</Link>
        </nav>
        <form action={signOutAction}>
          <button type="submit" className="text-xs font-bold uppercase">
            Déconnexion
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Écrire `app/admin/page.tsx`**

```tsx
import Link from "next/link"
import { listResources } from "@/lib/resources/service"
import { getStatsOverview } from "@/lib/stats/queries"
import { createResourceAction } from "@/lib/actions/admin"

export const dynamic = "force-dynamic"

export default async function AdminDashboard() {
  const [resources, overview] = await Promise.all([listResources(), getStatsOverview()])
  const stat = (slug: string) => overview.find((o) => o.slug === slug)

  return (
    <div>
      <h1 className="text-4xl font-black tracking-tight">Tableau de bord</h1>

      <form action={createResourceAction} className="mt-6 flex gap-2">
        <input name="title" required placeholder="Titre d'une nouvelle ressource" className="flex-1 border-2 border-foreground px-3 py-2" />
        <button type="submit" className="border-4 border-foreground bg-foreground px-4 py-2 font-bold text-background">
          Créer
        </button>
      </form>

      <ul className="mt-8 border-t-4 border-foreground">
        {resources.map((r) => {
          const s = stat(r.slug)
          return (
            <li key={r.slug} className="flex items-center justify-between gap-4 border-b-4 border-foreground py-4">
              <div>
                <Link href={`/admin/r/${r.slug}`} className="text-xl font-bold hover:underline">
                  {r.title}
                </Link>
                <div className="mt-1 flex gap-2 text-xs font-bold uppercase">
                  <span className="border-2 border-foreground px-1">{r.published ? "Publié" : "Brouillon"}</span>
                  {r.featured && <span className="border-2 border-foreground px-1">★ Featured</span>}
                  <span className="border-2 border-foreground px-1">{r.visibility}</span>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{s?.pageViews ?? 0} vues</div>
                <div className="text-muted-foreground">{s?.gateImpressions ?? 0} gate</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat: layout admin + tableau de bord"
```

---

## Task 8: Éditeur de ressource + arbre de pages

**Files:** Create `components/admin/page-tree-editor.tsx`, `app/admin/r/[slug]/page.tsx`

- [ ] **Step 1: Écrire `components/admin/page-tree-editor.tsx`** (récursif, server)

```tsx
import Link from "next/link"
import {
  addPageAction,
  renamePageAction,
  deletePageAction,
  movePageAction,
} from "@/lib/actions/admin"

type Node = { id: string; slug: string; title: string; path: string[]; children: Node[] }

function Level({ nodes, resourceSlug, parentPath }: { nodes: Node[]; resourceSlug: string; parentPath: string[] }) {
  const orderedIds = nodes.map((n) => n.id).join(",")
  return (
    <ul className="space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="border-2 border-foreground p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/r/${resourceSlug}/p/${node.path.join("/")}`} className="font-bold hover:underline">
              {node.title}
            </Link>
            <span className="text-xs text-muted-foreground">/{node.path.join("/")}</span>
            <span className="ml-auto flex gap-1">
              <MoveBtn resourceSlug={resourceSlug} id={node.id} orderedIds={orderedIds} dir="up" />
              <MoveBtn resourceSlug={resourceSlug} id={node.id} orderedIds={orderedIds} dir="down" />
            </span>
          </div>
          <form action={renamePageAction} className="mt-2 flex flex-wrap gap-1">
            <input type="hidden" name="resourceSlug" value={resourceSlug} />
            <input type="hidden" name="path" value={node.path.join("/")} />
            <input name="title" defaultValue={node.title} className="border-2 border-foreground px-2 py-1 text-sm" />
            {node.path.length > 0 && (
              <input name="slug" defaultValue={node.slug} className="w-28 border-2 border-foreground px-2 py-1 text-sm" />
            )}
            <button type="submit" className="border-2 border-foreground px-2 py-1 text-sm font-bold">
              Renommer
            </button>
          </form>
          {node.path.length > 0 && (
            <form action={deletePageAction} className="mt-1">
              <input type="hidden" name="resourceSlug" value={resourceSlug} />
              <input type="hidden" name="path" value={node.path.join("/")} />
              <button type="submit" className="border-2 border-foreground px-2 py-1 text-sm font-bold hover:bg-muted">
                Supprimer la page
              </button>
            </form>
          )}
          {node.children.length > 0 && (
            <div className="mt-2 ml-4 border-l-2 border-border pl-3">
              <Level nodes={node.children} resourceSlug={resourceSlug} parentPath={node.path} />
            </div>
          )}
        </li>
      ))}
      <li>
        <form action={addPageAction} className="flex flex-wrap gap-1 border-2 border-dashed border-foreground p-2">
          <input type="hidden" name="resourceSlug" value={resourceSlug} />
          <input type="hidden" name="parentPath" value={parentPath.join("/")} />
          <input name="title" placeholder="Titre sous-page" required className="border-2 border-foreground px-2 py-1 text-sm" />
          <input name="slug" placeholder="slug" required className="w-28 border-2 border-foreground px-2 py-1 text-sm" />
          <button type="submit" className="border-2 border-foreground px-2 py-1 text-sm font-bold">
            + Sous-page
          </button>
        </form>
      </li>
    </ul>
  )
}

function MoveBtn({ resourceSlug, id, orderedIds, dir }: { resourceSlug: string; id: string; orderedIds: string; dir: "up" | "down" }) {
  return (
    <form action={movePageAction}>
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderedIds" value={orderedIds} />
      <input type="hidden" name="direction" value={dir} />
      <button type="submit" className="border-2 border-foreground px-2 text-sm font-bold">
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  )
}

export function PageTreeEditor({ root, resourceSlug }: { root: Node; resourceSlug: string }) {
  // La racine s'édite via le formulaire métadonnées ; on édite ses enfants et on lie vers la racine.
  return (
    <div>
      <Link href={`/admin/r/${resourceSlug}/p/`} className="font-bold hover:underline">
        {root.title} (page racine)
      </Link>
      <div className="mt-3">
        <Level nodes={root.children} resourceSlug={resourceSlug} parentPath={[]} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Écrire `app/admin/r/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation"
import { getResource } from "@/lib/resources/service"
import { getGrantedEmails } from "@/lib/content/queries"
import { getResourceStats } from "@/lib/stats/queries"
import { updateResourceMetaAction, deleteResourceAction, grantAccessAction, revokeAccessAction } from "@/lib/actions/admin"
import { PageTreeEditor } from "@/components/admin/page-tree-editor"

export const dynamic = "force-dynamic"

export default async function ResourceEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let data
  try {
    data = await getResource(slug)
  } catch {
    notFound()
  }
  const stats = await getResourceStats(slug)
  const grantedEmails = data.visibility === "private" ? await getGrantedEmails(stats.slug === slug ? slug : slug) : []

  const field = "border-2 border-foreground px-3 py-2 w-full"

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-black tracking-tight">{data.title}</h1>

      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest">Métadonnées</h2>
        <form action={updateResourceMetaAction} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input name="title" defaultValue={data.title} className={field} />
          <textarea name="description" defaultValue={data.description ?? ""} className={field} rows={2} />
          <input name="coverImageUrl" defaultValue={data.coverImageUrl ?? ""} placeholder="URL cover (R2)" className={field} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              Visibilité
              <select name="visibility" defaultValue={data.visibility} className="border-2 border-foreground px-2 py-1">
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="published" defaultChecked={data.published} /> Publié
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="featured" defaultChecked={data.featured} /> Featured
            </label>
          </div>
          <button type="submit" className="border-4 border-foreground bg-foreground px-4 py-2 font-bold text-background">
            Enregistrer
          </button>
        </form>
      </section>

      {data.visibility === "private" && (
        <section>
          <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest">Accès privé</h2>
          <ul className="mb-3 space-y-1">
            {grantedEmails.map((e) => (
              <li key={e} className="flex items-center gap-2">
                <span>{e}</span>
                <form action={revokeAccessAction}>
                  <input type="hidden" name="resourceSlug" value={slug} />
                  <input type="hidden" name="email" value={e} />
                  <button type="submit" className="border-2 border-foreground px-2 text-sm font-bold">Retirer</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={grantAccessAction} className="flex gap-2">
            <input type="hidden" name="resourceSlug" value={slug} />
            <input name="email" type="email" required placeholder="email@client.com" className="flex-1 border-2 border-foreground px-3 py-2" />
            <button type="submit" className="border-2 border-foreground px-3 py-2 font-bold">Attribuer</button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest">Pages</h2>
        <PageTreeEditor root={data.root as never} resourceSlug={slug} />
      </section>

      <section>
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest">Statistiques</h2>
        <p className="text-sm">
          {stats.totalPageViews} vues · {stats.uniqueViewers} uniques · {stats.gateImpressions} gate
        </p>
        <ul className="mt-2 text-sm text-muted-foreground">
          {stats.perPage.map((p) => (
            <li key={p.pageId}>{p.title} : {p.views}</li>
          ))}
        </ul>
      </section>

      <section className="border-t-4 border-foreground pt-6">
        <form action={deleteResourceAction}>
          <input type="hidden" name="slug" value={slug} />
          <button type="submit" className="border-4 border-foreground px-4 py-2 font-bold hover:bg-muted">
            Supprimer la ressource
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add components/admin/page-tree-editor.tsx "app/admin/r/[slug]/page.tsx"
git commit -m "feat: éditeur de ressource (métadonnées, accès, arbre, stats)"
```

---

## Task 9: Éditeur de page (modules) + ModuleForm

**Files:** Create `components/admin/module-form.tsx`, `app/admin/r/[slug]/p/[...path]/page.tsx`

- [ ] **Step 1: Écrire `components/admin/module-form.tsx`** (client)

```tsx
"use client"

import { useState } from "react"

type ModuleData = { id?: string; type: string; content: Record<string, unknown> }

export function ModuleForm({
  action,
  resourceSlug,
  path,
  module,
}: {
  action: (formData: FormData) => void | Promise<void>
  resourceSlug: string
  path: string[]
  module?: ModuleData
}) {
  const [type, setType] = useState(module?.type ?? "markdown")
  const editing = !!module?.id
  const c = module?.content ?? {}
  const field = "w-full border-2 border-foreground px-2 py-1 text-sm"

  return (
    <form action={action} className="space-y-2 border-2 border-foreground p-3">
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
      <input type="hidden" name="path" value={path.join("/")} />
      {editing && <input type="hidden" name="id" value={module!.id} />}
      <input type="hidden" name="type" value={type} />

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={editing}
        className="border-2 border-foreground px-2 py-1 text-sm"
      >
        {["markdown", "callout", "image", "video", "file", "embed"].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {(type === "markdown" || type === "callout") && (
        <textarea name="md" defaultValue={String(c.md ?? "")} rows={5} className={field} placeholder="Markdown…" />
      )}
      {type === "callout" && (
        <select name="variant" defaultValue={String(c.variant ?? "info")} className="border-2 border-foreground px-2 py-1 text-sm">
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="success">success</option>
        </select>
      )}
      {(type === "image" || type === "video" || type === "file" || type === "embed") && (
        <input name="url" defaultValue={String(c.url ?? "")} placeholder="URL (R2 / externe)" className={field} />
      )}
      {type === "image" && (
        <>
          <input name="alt" defaultValue={String(c.alt ?? "")} placeholder="alt" className={field} />
          <input name="caption" defaultValue={String(c.caption ?? "")} placeholder="légende" className={field} />
        </>
      )}
      {type === "video" && <input name="caption" defaultValue={String(c.caption ?? "")} placeholder="légende" className={field} />}
      {type === "file" && (
        <>
          <input name="label" defaultValue={String(c.label ?? "")} placeholder="libellé" className={field} />
          <input name="filename" defaultValue={String(c.filename ?? "")} placeholder="nom de fichier" className={field} />
          <input name="size" type="number" defaultValue={c.size ? String(c.size) : ""} placeholder="taille (octets)" className={field} />
        </>
      )}

      <button type="submit" className="border-4 border-foreground bg-foreground px-3 py-1 font-bold text-background">
        {editing ? "Enregistrer" : "Ajouter le module"}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Écrire `app/admin/r/[slug]/p/[...path]/page.tsx`**

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getResource } from "@/lib/resources/service"
import { addModuleAction, updateModuleAction, deleteModuleAction, moveModuleAction } from "@/lib/actions/admin"
import { ModuleForm } from "@/components/admin/module-form"

export const dynamic = "force-dynamic"

type Node = { id: string; slug: string; title: string; path: string[]; modules: { id: string; type: string; position: number; content: Record<string, unknown> }[]; children: Node[] }

function findNode(node: Node, path: string[]): Node | null {
  if (path.length === 0) return node
  const [head, ...rest] = path
  const child = node.children.find((c) => c.slug === head)
  return child ? findNode(child, rest) : null
}

export default async function PageEditor({ params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path = [] } = await params
  let data
  try {
    data = await getResource(slug)
  } catch {
    notFound()
  }
  const page = findNode(data.root as Node, path)
  if (!page) notFound()

  const orderedIds = page.modules.map((m) => m.id).join(",")

  return (
    <div className="space-y-6">
      <Link href={`/admin/r/${slug}`} className="text-xs font-bold uppercase">
        ← {data.title}
      </Link>
      <h1 className="text-3xl font-black tracking-tight">{page.title}</h1>

      <ul className="space-y-3">
        {page.modules.map((m) => (
          <li key={m.id} className="border-2 border-foreground p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase">
              <span className="border-2 border-foreground px-1">{m.type}</span>
              <span className="ml-auto flex gap-1">
                <MoveModule slug={slug} path={path} id={m.id} orderedIds={orderedIds} dir="up" />
                <MoveModule slug={slug} path={path} id={m.id} orderedIds={orderedIds} dir="down" />
                <DeleteModule slug={slug} id={m.id} />
              </span>
            </div>
            <ModuleForm action={updateModuleAction} resourceSlug={slug} path={path} module={{ id: m.id, type: m.type, content: m.content }} />
          </li>
        ))}
      </ul>

      <section>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest">Ajouter un module</h2>
        <ModuleForm action={addModuleAction} resourceSlug={slug} path={path} />
      </section>
    </div>
  )
}

function MoveModule({ slug, path, id, orderedIds, dir }: { slug: string; path: string[]; id: string; orderedIds: string; dir: "up" | "down" }) {
  return (
    <form action={moveModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="path" value={path.join("/")} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderedIds" value={orderedIds} />
      <input type="hidden" name="direction" value={dir} />
      <button type="submit" className="border-2 border-foreground px-2 font-bold">{dir === "up" ? "↑" : "↓"}</button>
    </form>
  )
}

function DeleteModule({ slug, id }: { slug: string; id: string }) {
  return (
    <form action={deleteModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="border-2 border-foreground px-2 font-bold hover:bg-muted">✕</button>
    </form>
  )
}
```

- [ ] **Step 3: Typecheck + build + commit**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur ; routes `/admin`, `/admin/r/[slug]`, `/admin/r/[slug]/p/[...path]` listées.

```bash
git add components/admin/module-form.tsx "app/admin/r/[slug]/p/[...path]/page.tsx"
git commit -m "feat: éditeur de page (modules) + ModuleForm"
```

---

## Task 10: Vérification end-to-end + gates

Serveur en mode console OTP pour s'authentifier.

- [ ] **Step 1: Base + serveur + admin**

```bash
docker compose up -d
npm run db:push
npm run db:seed
RESEND_API_KEY= RESEND_FROM_EMAIL= npx next dev -p 3001 > /tmp/lab-ress-dev.log 2>&1 &
# attendre "Ready"
# créer le compte admin via une première connexion OTP, puis le promouvoir
B=http://localhost:3001
curl -s -X POST $B/api/auth/email-otp/send-verification-otp -H 'content-type: application/json' -d '{"email":"admin@test.com","type":"sign-in"}' >/dev/null
sleep 1
CODE=$(grep -oE '\[OTP\] admin@test.com -> [0-9]+' /tmp/lab-ress-dev.log | tail -1 | grep -oE '[0-9]+$')
curl -s -c /tmp/jar-admin.txt -X POST $B/api/auth/sign-in/email-otp -H 'content-type: application/json' -d "{\"email\":\"admin@test.com\",\"otp\":\"$CODE\"}" >/dev/null
npm run db:make-admin admin@test.com
```

- [ ] **Step 2: Vérifier le gating**

```bash
B=http://localhost:3001
# anonyme → redirige
curl -s -o /dev/null -w "anon /admin: %{http_code} -> %{redirect_url}\n" $B/admin
# admin (cookie) → 200
curl -s -o /dev/null -w "admin /admin: %{http_code}\n" -b /tmp/jar-admin.txt $B/admin
```
Expected : anonyme `307 -> /connexion` ; admin `200`. (Note : la session admin a été établie avant la promotion ; si `/admin` renvoie une redirection pour l'admin, se reconnecter pour rafraîchir la session, puis re-tester.)

- [ ] **Step 3: Vérifier le rendu de la console**

```bash
B=http://localhost:3001
echo "dashboard liste Guide IA : $(curl -s -b /tmp/jar-admin.txt $B/admin | grep -c 'Guide IA')"
echo "éditeur ressource (métadonnées) : $(curl -s -b /tmp/jar-admin.txt $B/admin/r/guide-ia | grep -c 'Métadonnées')"
echo "éditeur ressource (arbre Prompting) : $(curl -s -b /tmp/jar-admin.txt $B/admin/r/guide-ia | grep -c 'Prompting')"
echo "éditeur de page racine (ajout module) : $(curl -s -b /tmp/jar-admin.txt $B/admin/r/guide-ia/p/ | grep -c 'Ajouter un module')"
```
Expected : chaque compteur ≥ 1.

- [ ] **Step 4: Gates finaux**

```bash
pkill -f "next dev"
npm test
npm run typecheck
npm run lint
npm run build
```
Expected : tout vert.

- [ ] **Step 5: Commit final éventuel**

```bash
git add -A && git commit -m "test: vérification end-to-end lot 5"
```

---

## Self-review (couverture spec → plan)

- Flag `is_admin` + additionalField + bootstrap → Task 1. ✓
- `requireAdmin` → Task 2 ; appliqué dans le layout (Task 7) et chaque action (Task 6). ✓
- Dashboard (overview stats + liste) → Task 7. ✓
- Gestion ressource (créer/éditer méta/supprimer) → Tasks 6, 7, 8. ✓
- Builder pages (ajout/renommage/suppression/↑↓) → Tasks 6, 8. ✓
- Builder modules (ajout typé/édition/suppression/↑↓) → Tasks 6, 9. ✓
- Accès privé (lister/attribuer/retirer) → Task 8. ✓
- Stats par ressource → Task 8. ✓
- `moveInList` (pur) + `buildModuleContent` (pur) → Tasks 3, 4. ✓
- `reorderPages` + `coverImageUrl` → Task 5. ✓
- Vérif (gating live, rendu) → Task 10. ✓

Cohérence des types : actions (Task 6) appellent `service.*` (lots 3 + Task 5) et `moveInList`/`buildModuleContent` (Tasks 3-4) ; `getResource` renvoie `root` avec `{id,slug,title,path,modules,children}` consommé par `PageTreeEditor` (Task 8) et `findNode`/`ModuleForm` (Task 9) ; les server actions sont passées en props aux composants (`ModuleForm`, boutons) avec la signature `(formData: FormData) => void | Promise<void>`.

**Note de vérification :** les server actions Next se prêtent mal au test par curl ; leur correction repose sur la couche service (déjà testée unitairement et e2e via MCP aux lots 3-4) et sur le rendu des pages. Le gating admin (nouvelle frontière de sécurité) et le rendu de la console sont, eux, vérifiés en live.
```
