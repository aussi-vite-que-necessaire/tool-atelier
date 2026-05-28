# Lot 4 — Statistiques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enregistrer les vues de page et impressions de gate dans une table d'événements, et exposer les statistiques agrégées via un outil MCP `get_stats`.

**Architecture:** Table `view_events` append-only. Le reader enregistre chaque vue autorisée (`page_view`) et chaque gate (`gate_view`), en ignorant les requêtes de préchargement Next. Une fonction pure agrège les événements d'une ressource ; un outil MCP les expose. Logique pure (agrégation, détection prefetch) isolée et testée.

**Tech Stack:** Drizzle/Postgres, MCP (mcp-handler), Next 16, Vitest.

---

## Structure des fichiers

```
db/schema/stats.ts        table view_events
db/schema/index.ts        + export ./stats
lib/stats/aggregate.ts    aggregateResourceStats (pur) + types
lib/stats/aggregate.test.ts
lib/stats/prefetch.ts     isPrefetchRequest (pur)
lib/stats/prefetch.test.ts
lib/stats/record.ts       recordPageView, recordGateView (insert, try/catch)
lib/stats/queries.ts      getResourceStats, getStatsOverview
app/(public)/r/[slug]/render.tsx   + enregistrement des vues + filtrage prefetch
lib/resources/mcp.ts      + outil get_stats
```

---

## Task 1: Table view_events

**Files:** Create `db/schema/stats.ts` ; Modify `db/schema/index.ts`

- [ ] **Step 1: Écrire `db/schema/stats.ts`**

```ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { resources, pages } from "./content"
import { user } from "./auth"

export const viewEvents = pgTable(
  "view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("view_events_resource_created").on(t.resourceId, t.createdAt)],
)
```

- [ ] **Step 2: Ajouter l'export dans `db/schema/index.ts`**

```ts
export * from "./auth"
export * from "./content"
export * from "./access"
export * from "./stats"
```

- [ ] **Step 3: Pousser le schéma**

Run : `npm run db:push`
Expected : table `view_events` créée.

- [ ] **Step 4: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add db/schema/stats.ts db/schema/index.ts
git commit -m "feat: table view_events (statistiques)"
```

---

## Task 2: Agrégation (TDD)

**Files:** Create `lib/stats/aggregate.ts`, `lib/stats/aggregate.test.ts`

- [ ] **Step 1: Écrire `lib/stats/aggregate.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { aggregateResourceStats } from "./aggregate"

const pages = [
  { id: "root", title: "Intro", path: [] as string[] },
  { id: "p1", title: "Prompting", path: ["prompting"] },
]

describe("aggregateResourceStats", () => {
  it("compte vues totales, uniques, gate et par page", () => {
    const events = [
      { pageId: "root", userId: "u1", type: "page_view" as const },
      { pageId: "root", userId: "u1", type: "page_view" as const },
      { pageId: "p1", userId: "u2", type: "page_view" as const },
      { pageId: null, userId: null, type: "gate_view" as const },
      { pageId: null, userId: "u3", type: "gate_view" as const },
    ]
    const stats = aggregateResourceStats(events, pages)
    expect(stats.totalPageViews).toBe(3)
    expect(stats.uniqueViewers).toBe(2) // u1, u2
    expect(stats.gateImpressions).toBe(2)
    expect(stats.perPage).toEqual([
      { pageId: "root", title: "Intro", path: [], views: 2 },
      { pageId: "p1", title: "Prompting", path: ["prompting"], views: 1 },
    ])
  })

  it("renvoie zéro partout sans événements", () => {
    const stats = aggregateResourceStats([], pages)
    expect(stats.totalPageViews).toBe(0)
    expect(stats.uniqueViewers).toBe(0)
    expect(stats.gateImpressions).toBe(0)
    expect(stats.perPage.every((p) => p.views === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer (échec attendu)**

Run : `npx vitest run lib/stats/aggregate.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/stats/aggregate.ts`**

```ts
export type ViewEvent = { pageId: string | null; userId: string | null; type: "page_view" | "gate_view" }
export type StatPage = { id: string; title: string; path: string[] }

export type ResourceStats = {
  totalPageViews: number
  uniqueViewers: number
  gateImpressions: number
  perPage: { pageId: string; title: string; path: string[]; views: number }[]
}

export function aggregateResourceStats(events: ViewEvent[], pages: StatPage[]): ResourceStats {
  const pageViews = events.filter((e) => e.type === "page_view")
  const gateViews = events.filter((e) => e.type === "gate_view")

  const uniq = new Set(pageViews.map((e) => e.userId).filter((u): u is string => u !== null))

  const counts = new Map<string, number>()
  for (const e of pageViews) {
    if (e.pageId) counts.set(e.pageId, (counts.get(e.pageId) ?? 0) + 1)
  }

  return {
    totalPageViews: pageViews.length,
    uniqueViewers: uniq.size,
    gateImpressions: gateViews.length,
    perPage: pages.map((p) => ({ pageId: p.id, title: p.title, path: p.path, views: counts.get(p.id) ?? 0 })),
  }
}
```

- [ ] **Step 4: Lancer (succès) + commit**

Run : `npx vitest run lib/stats/aggregate.test.ts`
Expected : PASS.

```bash
git add lib/stats/aggregate.ts lib/stats/aggregate.test.ts
git commit -m "feat: aggregateResourceStats (pur)"
```

---

## Task 3: Détection du préchargement (TDD)

**Files:** Create `lib/stats/prefetch.ts`, `lib/stats/prefetch.test.ts`

- [ ] **Step 1: Écrire `lib/stats/prefetch.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { isPrefetchRequest } from "./prefetch"

const headers = (map: Record<string, string>) => ({ get: (n: string) => map[n.toLowerCase()] ?? null })

describe("isPrefetchRequest", () => {
  it("vrai sur Next-Router-Prefetch", () => {
    expect(isPrefetchRequest(headers({ "next-router-prefetch": "1" }))).toBe(true)
  })
  it("vrai sur Sec-Purpose: prefetch", () => {
    expect(isPrefetchRequest(headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true)
  })
  it("vrai sur Purpose: prefetch", () => {
    expect(isPrefetchRequest(headers({ purpose: "prefetch" }))).toBe(true)
  })
  it("faux sur une requête normale", () => {
    expect(isPrefetchRequest(headers({}))).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer (échec attendu)**

Run : `npx vitest run lib/stats/prefetch.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/stats/prefetch.ts`**

```ts
type HeaderGetter = { get(name: string): string | null }

export function isPrefetchRequest(headers: HeaderGetter): boolean {
  if (headers.get("next-router-prefetch") === "1") return true
  if ((headers.get("sec-purpose") ?? "").includes("prefetch")) return true
  if (headers.get("purpose") === "prefetch") return true
  return false
}
```

- [ ] **Step 4: Lancer (succès) + commit**

Run : `npx vitest run lib/stats/prefetch.test.ts`
Expected : PASS.

```bash
git add lib/stats/prefetch.ts lib/stats/prefetch.test.ts
git commit -m "feat: isPrefetchRequest (pur)"
```

---

## Task 4: Enregistrement des vues

**Files:** Create `lib/stats/record.ts`

- [ ] **Step 1: Écrire `lib/stats/record.ts`**

```ts
import { db } from "@/db"
import { viewEvents } from "@/db/schema"

export async function recordPageView(resourceId: string, pageId: string, userId: string | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId, userId, type: "page_view" })
  } catch (e) {
    console.error("recordPageView:", (e as Error).message)
  }
}

export async function recordGateView(resourceId: string, userId: string | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId: null, userId, type: "gate_view" })
  } catch (e) {
    console.error("recordGateView:", (e as Error).message)
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/stats/record.ts
git commit -m "feat: enregistrement des vues (page/gate)"
```

---

## Task 5: Requêtes de statistiques

**Files:** Create `lib/stats/queries.ts`

- [ ] **Step 1: Écrire `lib/stats/queries.ts`**

```ts
import { eq, and, gte, sql } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, viewEvents } from "@/db/schema"
import { buildPageTree, type TreePage } from "@/lib/content/tree"
import { aggregateResourceStats, type ViewEvent, type StatPage } from "./aggregate"

export async function getResourceStats(slug: string, sinceDays?: number) {
  const [resource] = await db.select().from(resources).where(eq(resources.slug, slug)).limit(1)
  if (!resource) throw new Error(`Ressource introuvable: ${slug}`)

  const pageRows = await db.select().from(pages).where(eq(pages.resourceId, resource.id))
  const root = buildPageTree(
    pageRows.map((p) => ({ id: p.id, parentId: p.parentId, slug: p.slug, title: p.title, position: p.position })),
  )
  const statPages: StatPage[] = []
  if (root) {
    const walk = (n: TreePage, path: string[]) => {
      statPages.push({ id: n.id, title: n.title, path })
      n.children.forEach((c) => walk(c, [...path, c.slug]))
    }
    walk(root, [])
  }

  const conds = [eq(viewEvents.resourceId, resource.id)]
  if (sinceDays) conds.push(gte(viewEvents.createdAt, new Date(Date.now() - sinceDays * 86400000)))
  const rows = await db
    .select({ pageId: viewEvents.pageId, userId: viewEvents.userId, type: viewEvents.type })
    .from(viewEvents)
    .where(and(...conds))
  const events: ViewEvent[] = rows.map((r) => ({
    pageId: r.pageId,
    userId: r.userId,
    type: r.type as "page_view" | "gate_view",
  }))

  return { slug: resource.slug, title: resource.title, sinceDays: sinceDays ?? null, ...aggregateResourceStats(events, statPages) }
}

export async function getStatsOverview() {
  const rows = await db
    .select({
      slug: resources.slug,
      title: resources.title,
      type: viewEvents.type,
      count: sql<number>`cast(count(${viewEvents.id}) as int)`,
    })
    .from(resources)
    .leftJoin(viewEvents, eq(viewEvents.resourceId, resources.id))
    .groupBy(resources.slug, resources.title, viewEvents.type)

  const map = new Map<string, { slug: string; title: string; pageViews: number; gateImpressions: number }>()
  for (const r of rows) {
    const cur = map.get(r.slug) ?? { slug: r.slug, title: r.title, pageViews: 0, gateImpressions: 0 }
    if (r.type === "page_view") cur.pageViews = r.count
    else if (r.type === "gate_view") cur.gateImpressions = r.count
    map.set(r.slug, cur)
  }
  return [...map.values()]
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/stats/queries.ts
git commit -m "feat: requêtes stats (par ressource + vue d'ensemble)"
```

---

## Task 6: Enregistrement dans le reader

**Files:** Modify `app/(public)/r/[slug]/render.tsx`

- [ ] **Step 1: Remplacer `app/(public)/r/[slug]/render.tsx`** (récupère les headers une fois, calcule prefetch, enregistre les vues)

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

export async function renderResourcePage(slug: string, path: string[]) {
  const data = await getResourceBySlug(slug)
  if (!data) notFound()

  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  const prefetch = isPrefetchRequest(h)
  const email = session?.user.email ?? null
  const grantedEmails =
    data.resource.visibility === "private" ? await getGrantedEmails(data.resource.id) : []

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

  const root = buildPageTree(data.flatPages)
  if (!root) notFound()

  const page = resolvePageByPath(root, path)
  if (!page) notFound()

  if (!prefetch) await recordPageView(data.resource.id, page.id, session?.user.id ?? null)

  const mods = await getPageModules(page.id)

  const toc: TocItem[] = mods
    .filter((m) => m.type === "markdown" || m.type === "callout")
    .flatMap((m) => extractToc((m.content as { md: string }).md))

  return (
    <ReaderShell resourceTitle={data.resource.title} root={root} basePath={`/r/${slug}`} currentId={page.id} toc={toc}>
      <h1 className="mb-6 text-4xl font-black tracking-tight">{page.title}</h1>
      {mods.map((m) => (
        <ModuleView key={m.id} module={m} />
      ))}
    </ReaderShell>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add "app/(public)/r/[slug]/render.tsx"
git commit -m "feat: enregistrement des vues dans le reader (+ filtrage prefetch)"
```

---

## Task 7: Outil MCP get_stats

**Files:** Modify `lib/resources/mcp.ts`

- [ ] **Step 1: Ajouter l'import en tête de `lib/resources/mcp.ts`** (après les imports existants)

```ts
import * as stats from "@/lib/stats/queries"
```

- [ ] **Step 2: Ajouter l'outil `get_stats`** dans `registerTools`, juste avant la fin de la fonction (après `revoke_access`)

```ts
  add(
    "get_stats",
    "Statistiques de vue. Avec slug : détail d'une ressource (vues, uniques, gate, par page). Sans slug : vue d'ensemble.",
    z.object({ slug: z.string().optional(), sinceDays: z.number().int().positive().optional() }),
    (args) => (args.slug ? stats.getResourceStats(args.slug, args.sinceDays) : stats.getStatsOverview()),
  )
```

- [ ] **Step 3: Typecheck + build + commit**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur ; build OK.

```bash
git add lib/resources/mcp.ts
git commit -m "feat: outil MCP get_stats"
```

---

## Task 8: Vérification end-to-end + gates

Serveur en mode console OTP (Resend neutralisé pour la session) afin de pouvoir s'authentifier.

- [ ] **Step 1: Démarrer base + serveur + seed**

```bash
docker compose up -d
npm run db:push
npm run db:seed
RESEND_API_KEY= RESEND_FROM_EMAIL= npx next dev -p 3001 > /tmp/lab-ress-dev.log 2>&1 &
# attendre "Ready"
```

- [ ] **Step 2: Générer des vues**

```bash
B=http://localhost:3001
# Connexion OTP (console) en tant que stats@test.com
curl -s -X POST $B/api/auth/email-otp/send-verification-otp -H 'content-type: application/json' -d '{"email":"stats@test.com","type":"sign-in"}' >/dev/null
sleep 1
CODE=$(grep -oE '\[OTP\] stats@test.com -> [0-9]+' /tmp/lab-ress-dev.log | tail -1 | grep -oE '[0-9]+$')
curl -s -c /tmp/jar-s.txt -X POST $B/api/auth/sign-in/email-otp -H 'content-type: application/json' -d "{\"email\":\"stats@test.com\",\"otp\":\"$CODE\"}" >/dev/null
# 2 vues de page racine + 1 sous-page (même user → 1 unique)
curl -s -b /tmp/jar-s.txt $B/r/guide-ia >/dev/null
curl -s -b /tmp/jar-s.txt $B/r/guide-ia >/dev/null
curl -s -b /tmp/jar-s.txt $B/r/guide-ia/prompting >/dev/null
# 1 impression de gate (anonyme)
curl -s $B/r/guide-ia >/dev/null
# 1 requête prefetch (NE doit PAS compter)
curl -s -b /tmp/jar-s.txt -H 'Next-Router-Prefetch: 1' $B/r/guide-ia >/dev/null
sleep 1
```

- [ ] **Step 3: Lire les stats via MCP**

```bash
ADMIN_API_KEY=dev-mcp-key-123 MCP_URL=http://localhost:3001/api/mcp node --env-file=.env.local --import tsx -e "
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const t = new StreamableHTTPClientTransport(new URL(process.env.MCP_URL), { requestInit: { headers: { Authorization: 'Bearer ' + process.env.ADMIN_API_KEY } } })
const c = new Client({ name: 's', version: '1.0.0' })
await c.connect(t)
const r = await c.callTool({ name: 'get_stats', arguments: { slug: 'guide-ia' } })
console.log(r.content[0].text)
await c.close(); process.exit(0)
"
```
Expected : `totalPageViews` = 3 (les 2 racine + 1 sous-page ; le prefetch n'est pas compté), `uniqueViewers` = 1, `gateImpressions` = 1, `perPage` montrant 2 vues sur la racine et 1 sur prompting.

- [ ] **Step 4: Vérifier la vue d'ensemble (sans slug)**

```bash
# même script, arguments: {} → tableau des ressources avec pageViews / gateImpressions
```
Expected : `guide-ia` avec `pageViews: 3`, `gateImpressions: 1`.

- [ ] **Step 5: Gates finaux**

```bash
pkill -f "next dev"
npm test
npm run typecheck
npm run lint
npm run build
```
Expected : tout vert.

- [ ] **Step 6: Commit final éventuel**

```bash
git add -A && git commit -m "test: vérification end-to-end lot 4"
```

---

## Self-review (couverture spec → plan)

- Table `view_events` (event-based) → Task 1. ✓
- Enregistrement page_view / gate_view dans le reader → Task 6. ✓
- Filtrage prefetch → Task 3 (pur) + Task 6 (usage). ✓
- try/catch non bloquant → Task 4. ✓
- Agrégation pure (totaux, uniques, gate, par page) → Task 2. ✓
- Requêtes par ressource + vue d'ensemble (SQL group by) → Task 5. ✓
- Outil MCP get_stats → Task 7. ✓
- Tests purs (aggregate, prefetch) → Tasks 2, 3. ✓
- Vérif e2e (vues réelles + prefetch ignoré + get_stats) → Task 8. ✓
- Critères d'acceptation → Task 8 + gates. ✓

Cohérence des types : `ViewEvent`/`StatPage`/`ResourceStats` (aggregate.ts) consommés par queries.ts ; `viewEvents` (schema) utilisé par record.ts et queries.ts ; `isPrefetchRequest`, `recordPageView`, `recordGateView` importés dans render.tsx (Task 6) avec les signatures définies aux Tasks 3-4 ; `getResourceStats`/`getStatsOverview` (Task 5) appelés par l'outil get_stats (Task 7).
```
