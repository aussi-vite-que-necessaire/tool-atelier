# Lot 6 — Partage + aperçu admin + lecture mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Métadonnées Open Graph par ressource, aperçu admin des brouillons (`?preview=1`), et navigation repliable sur mobile.

**Architecture:** Un builder pur de métadonnées + `generateMetadata` sur les routes reader. Le rendu du reader accepte un mode preview (admin) qui bypasse statut/gate sans enregistrer de stats. `ReaderShell` rend l'arbre dans un `<details>` sur mobile.

**Tech Stack:** Next 16 (App Router, generateMetadata), Drizzle, Vitest.

---

## Task 1: Builder de métadonnées (TDD) + requête

**Files:** Create `lib/content/metadata.ts`, `lib/content/metadata.test.ts` ; Modify `lib/content/queries.ts`

- [ ] **Step 1: `lib/content/metadata.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buildResourceMetadata } from "./metadata"

describe("buildResourceMetadata", () => {
  it("titre, description, url, type article", () => {
    const m = buildResourceMetadata({ title: "Guide", description: "Desc", coverImageUrl: null, url: "https://x/r/guide" })
    expect(m.title).toBe("Guide")
    expect(m.description).toBe("Desc")
    expect(m.openGraph?.url).toBe("https://x/r/guide")
    expect((m.openGraph as { type?: string }).type).toBe("article")
    expect(m.openGraph?.images).toBeUndefined()
  })
  it("ajoute l'image et la carte twitter si cover", () => {
    const m = buildResourceMetadata({ title: "G", description: null, coverImageUrl: "https://r2/c.png", url: "https://x/r/g" })
    expect(m.openGraph?.images).toEqual(["https://r2/c.png"])
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image")
  })
})
```

- [ ] **Step 2: Lancer (échec)** — `npx vitest run lib/content/metadata.test.ts` → FAIL.

- [ ] **Step 3: `lib/content/metadata.ts`**

```ts
import type { Metadata } from "next"

export function buildResourceMetadata(input: {
  title: string
  description: string | null
  coverImageUrl: string | null
  url: string
}): Metadata {
  const description = input.description ?? undefined
  const images = input.coverImageUrl ? [input.coverImageUrl] : undefined
  return {
    title: input.title,
    description,
    openGraph: {
      title: input.title,
      description,
      url: input.url,
      type: "article",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description,
      ...(images ? { images } : {}),
    },
  }
}
```

- [ ] **Step 4: Lancer (succès)** — `npx vitest run lib/content/metadata.test.ts` → PASS.

- [ ] **Step 5: Ajouter `getResourceMeta` et le param `includeUnpublished`** dans `lib/content/queries.ts`

Remplacer la signature de `getResourceBySlug` :

```ts
export async function getResourceBySlug(slug: string, includeUnpublished = false) {
  const [resource] = await db.select().from(resources).where(eq(resources.slug, slug)).limit(1)
  if (!resource || (!resource.published && !includeUnpublished)) return null
  // … (reste inchangé : flatPages)
```

Ajouter à la fin du fichier :

```ts
export async function getResourceMeta(slug: string) {
  const [r] = await db
    .select({
      title: resources.title,
      description: resources.description,
      coverImageUrl: resources.coverImageUrl,
      published: resources.published,
    })
    .from(resources)
    .where(eq(resources.slug, slug))
    .limit(1)
  return r ?? null
}
```

- [ ] **Step 6: Typecheck + commit**

Run : `npm run typecheck` → OK.

```bash
git add lib/content/metadata.ts lib/content/metadata.test.ts lib/content/queries.ts
git commit -m "feat: buildResourceMetadata (pur) + getResourceMeta + includeUnpublished"
```

---

## Task 2: generateMetadata + preview sur les routes reader

**Files:** Modify `app/(public)/r/[slug]/render.tsx`, `app/(public)/r/[slug]/page.tsx`, `app/(public)/r/[slug]/[...path]/page.tsx`

- [ ] **Step 1: `render.tsx`** — support du mode preview (admin), sans stats/abonnement, avec bandeau

```tsx
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { buildPageTree } from "@/lib/content/tree"
import { resolvePageByPath } from "@/lib/content/resolve"
import { extractToc, type TocItem } from "@/lib/content/toc"
import { canAccess } from "@/lib/access"
import { getResourceBySlug, getGrantedEmails, getPageModules, addSubscription } from "@/lib/content/queries"
import { isPrefetchRequest } from "@/lib/stats/prefetch"
import { recordPageView, recordGateView } from "@/lib/stats/record"
import { ReaderShell } from "@/components/reader/reader-shell"
import { ModuleView } from "@/components/modules/registry"
import { ResourceGate } from "@/components/auth/resource-gate"

export async function renderResourcePage(slug: string, path: string[], opts?: { preview?: boolean }) {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  const isAdmin = !!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  const preview = !!opts?.preview && isAdmin

  const data = await getResourceBySlug(slug, preview)
  if (!data) notFound()

  if (!preview) {
    const email = session?.user.email ?? null
    const grantedEmails = data.resource.visibility === "private" ? await getGrantedEmails(data.resource.id) : []
    const prefetch = isPrefetchRequest(h)
    if (!canAccess(data.resource, email, grantedEmails)) {
      if (!prefetch) await recordGateView(data.resource.id, session?.user.id ?? null)
      return (
        <ResourceGate
          title={data.resource.title}
          description={data.resource.description}
          coverImageUrl={data.resource.coverImageUrl}
        />
      )
    }
    if (session) await addSubscription(session.user.id, data.resource.id)
    var skipRecord = prefetch // eslint-disable-line no-var
  }

  const root = buildPageTree(data.flatPages)
  if (!root) notFound()
  const page = resolvePageByPath(root, path)
  if (!page) notFound()

  if (!preview && !skipRecord) await recordPageView(data.resource.id, page.id, session?.user.id ?? null)

  const mods = await getPageModules(page.id)
  const toc: TocItem[] = mods
    .filter((m) => m.type === "markdown" || m.type === "callout")
    .flatMap((m) => extractToc((m.content as { md: string }).md))

  return (
    <ReaderShell resourceTitle={data.resource.title} root={root} basePath={`/r/${slug}`} currentId={page.id} toc={toc}>
      {preview && (
        <div className="mb-4 border-4 border-foreground bg-muted px-3 py-2 text-xs font-extrabold uppercase tracking-widest">
          Aperçu — {data.resource.published ? "ressource publiée" : "brouillon"} ({data.resource.visibility})
        </div>
      )}
      <h1 className="mb-6 text-4xl font-black tracking-tight">{page.title}</h1>
      {mods.map((m) => (
        <ModuleView key={m.id} module={m} />
      ))}
    </ReaderShell>
  )
}
```

> Note : `skipRecord` est déclaré dans le bloc `!preview`. Pour éviter l'usage de `var`,
> implémenter en calculant `prefetch` en tête et en gardant la logique linéaire (voir
> implémentation finale). L'intention : pas d'enregistrement en preview ni en prefetch.

- [ ] **Step 2: `app/(public)/r/[slug]/page.tsx`** — generateMetadata + preview

```tsx
import type { Metadata } from "next"
import { getResourceMeta } from "@/lib/content/queries"
import { buildResourceMetadata } from "@/lib/content/metadata"
import { resourceUrl } from "@/lib/resources/service"
import { renderResourcePage } from "./render"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const meta = await getResourceMeta(slug)
  if (!meta || !meta.published) return { title: "Ressources" }
  return buildResourceMetadata({
    title: meta.title,
    description: meta.description,
    coverImageUrl: meta.coverImageUrl,
    url: resourceUrl(slug),
  })
}

export default async function ResourceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { slug } = await params
  const { preview } = await searchParams
  return renderResourcePage(slug, [], { preview: preview === "1" })
}
```

- [ ] **Step 3: `app/(public)/r/[slug]/[...path]/page.tsx`** — idem (réutilise la meta ressource)

```tsx
import type { Metadata } from "next"
import { getResourceMeta } from "@/lib/content/queries"
import { buildResourceMetadata } from "@/lib/content/metadata"
import { resourceUrl } from "@/lib/resources/service"
import { renderResourcePage } from "../render"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string; path: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const meta = await getResourceMeta(slug)
  if (!meta || !meta.published) return { title: "Ressources" }
  return buildResourceMetadata({
    title: meta.title,
    description: meta.description,
    coverImageUrl: meta.coverImageUrl,
    url: resourceUrl(slug),
  })
}

export default async function ResourceSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; path: string[] }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { slug, path } = await params
  const { preview } = await searchParams
  return renderResourcePage(slug, path, { preview: preview === "1" })
}
```

- [ ] **Step 4: Typecheck + commit**

Run : `npm run typecheck` → OK.

```bash
git add "app/(public)/r/[slug]/render.tsx" "app/(public)/r/[slug]/page.tsx" "app/(public)/r/[slug]/[...path]/page.tsx"
git commit -m "feat: Open Graph par ressource + aperçu admin (?preview=1)"
```

---

## Task 3: Navigation mobile (ReaderShell)

**Files:** Modify `components/reader/reader-shell.tsx`

- [ ] **Step 1: Remplacer `components/reader/reader-shell.tsx`**

```tsx
import Link from "next/link"
import type { TreePage } from "@/lib/content/tree"
import type { TocItem } from "@/lib/content/toc"
import { PageTree } from "./page-tree"
import { Toc } from "./toc"

export function ReaderShell({
  resourceTitle,
  root,
  basePath,
  currentId,
  toc,
  children,
}: {
  resourceTitle: string
  root: TreePage
  basePath: string
  currentId: string
  toc: TocItem[]
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto min-h-screen max-w-7xl">
      <header className="flex items-center justify-between border-b-4 border-foreground px-6 py-3">
        <Link href="/" className="text-xs font-extrabold uppercase tracking-widest">
          Ressources
        </Link>
        <span className="text-xs font-bold uppercase tracking-wide">{resourceTitle}</span>
      </header>

      <details className="border-b-4 border-foreground md:hidden">
        <summary className="cursor-pointer px-6 py-3 text-xs font-extrabold uppercase tracking-widest">Pages</summary>
        <div className="px-6 pb-4">
          <PageTree root={root} basePath={basePath} currentId={currentId} />
        </div>
      </details>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_200px]">
        <aside className="hidden border-r-4 border-foreground p-4 md:block">
          <PageTree root={root} basePath={basePath} currentId={currentId} />
        </aside>
        <main className="min-w-0 px-6 py-8">{children}</main>
        <aside className="hidden border-l-4 border-foreground p-4 lg:block">
          <Toc items={toc} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck` → OK.

```bash
git add components/reader/reader-shell.tsx
git commit -m "feat: navigation repliable du reader sur mobile"
```

---

## Task 4: Lien « Aperçu » dans l'éditeur admin

**Files:** Modify `app/admin/r/[slug]/page.tsx`

- [ ] **Step 1: Ajouter un lien Aperçu** sous le titre `<h1>{data.title}</h1>` de l'éditeur

```tsx
      <h1 className="text-4xl font-black tracking-tight">{data.title}</h1>
      <a
        href={`/r/${slug}?preview=1`}
        target="_blank"
        rel="noreferrer"
        className="inline-block border-2 border-foreground px-3 py-1 text-sm font-bold"
      >
        Aperçu ↗
      </a>
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck` → OK.

```bash
git add "app/admin/r/[slug]/page.tsx"
git commit -m "feat: lien Aperçu dans l'éditeur admin"
```

---

## Task 5: Vérification end-to-end + gates

Serveur en mode console OTP, admin promu (cf. lot 5).

- [ ] **Step 1: Base + serveur + admin** (comme lot 5 : seed, `db:make-admin admin@test.com`, login admin → `/tmp/jar-admin.txt`).

- [ ] **Step 2: Open Graph**

```bash
B=http://localhost:3001
echo "og:title : $(curl -s $B/r/guide-ia | grep -c 'property="og:title"')"
echo "og:url : $(curl -s $B/r/guide-ia | grep -c 'property="og:url"')"
echo "og:image (cover seedée) : $(curl -s $B/r/guide-ia | grep -c 'property="og:image"')"
```
Expected : chaque compteur ≥ 1.

- [ ] **Step 3: Aperçu admin d'un brouillon**

```bash
B=http://localhost:3001; J=/tmp/jar-admin.txt
# créer un brouillon via MCP (published:false) — ou dépublier guide-ia via l'admin
# brouillon sans preview → 404
curl -s -o /dev/null -w "draft sans preview: %{http_code}\n" "$B/r/<slug-brouillon>"
# admin avec preview → 200 + bandeau
curl -s -b $J "$B/r/<slug-brouillon>?preview=1" | grep -c "Aperçu —"
```
Expected : 404 sans preview ; ≥1 (bandeau) avec preview admin. Vérifier qu'aucune vue n'est enregistrée (compter `view_events` avant/après).

- [ ] **Step 4: Mobile**

```bash
echo "volet details mobile : $(curl -s http://localhost:3001/r/guide-ia -b /tmp/jar-admin.txt | grep -c '<details')"
```
Expected : ≥1.

- [ ] **Step 5: Gates finaux**

```bash
pkill -f "next dev"
npm test && npm run typecheck && npm run lint && npm run build
```
Expected : tout vert.

- [ ] **Step 6: Commit final éventuel**

```bash
git add -A && git commit -m "test: vérification end-to-end lot 6"
```

---

## Self-review (couverture spec → plan)

- Open Graph par ressource → Tasks 1 (builder + meta) + 2 (generateMetadata). ✓
- Aperçu admin (?preview=1, admin-only, sans stats) → Task 2 (render + routes). ✓
- Lecture mobile (`<details>`) → Task 3. ✓
- Lien Aperçu admin → Task 4. ✓
- Tests purs (buildResourceMetadata) → Task 1. ✓
- Vérif e2e (OG, preview, mobile) → Task 5. ✓

Cohérence : `buildResourceMetadata` (metadata.ts) appelé par les deux routes ; `getResourceMeta`/`getResourceBySlug(…, includeUnpublished)` (queries.ts) consommés par routes + render ; `resourceUrl` (service.ts) réutilisé pour l'URL OG ; `renderResourcePage(slug, path, { preview })` signature alignée entre render.tsx et les routes.
```
