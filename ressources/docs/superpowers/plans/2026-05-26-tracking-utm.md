# Tracking de provenance (UTM) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capter la provenance UTM des visiteurs (first-touch), l'attribuer au trafic et aux utilisateurs débloqués, et la restituer dans les dashboards admin et l'outil MCP `get_stats`.

**Architecture:** Un middleware pose un cookie first-touch `lab_ref` dès qu'un lien tagué est cliqué. Le reader lit ce cookie et l'attache aux `view_events` (trafic) et à la `subscription` (acquisition, figée à l'insert). Des fonctions pures agrègent les ventilations par source/campagne, affichées dans `/admin` et `/admin/r/[slug]`.

**Tech Stack:** Next.js 16 (App Router, middleware), Drizzle/Postgres, Vitest, Tailwind v4.

Référence : `docs/superpowers/specs/2026-05-26-tracking-utm-design.md`.

---

## File Structure

- `lib/tracking/ref.ts` (créer) — logique pure : parse UTM/`src` depuis `URLSearchParams`, normalisation, (dé)sérialisation cookie, constantes.
- `lib/tracking/ref.test.ts` (créer) — tests de `ref.ts`.
- `middleware.ts` (créer) — pose du cookie first-touch sur `/r/:path*`.
- `db/schema/stats.ts` (modifier) — colonnes `source`/`medium`/`campaign` sur `view_events`.
- `db/schema/access.ts` (modifier) — colonnes `source`/`medium`/`campaign` sur `subscriptions`.
- `lib/stats/record.ts` (modifier) — `recordGateView`/`recordPageView` acceptent un `ref`.
- `lib/content/queries.ts` (modifier) — `addSubscription` accepte un `ref` (figé à l'insert).
- `app/(public)/r/[slug]/render.tsx` (modifier) — lit le cookie, transmet le `ref`.
- `lib/stats/aggregate.ts` (modifier) — type `ViewEvent` enrichi + `aggregateBySource` + acquisition.
- `lib/stats/aggregate.test.ts` (modifier) — tests des nouvelles agrégations.
- `lib/stats/queries.ts` (modifier) — `getResourceStats` + `getStatsOverview` enrichis.
- `app/admin/r/[slug]/page.tsx` (modifier) — section « Sources ».
- `app/admin/page.tsx` (modifier) — panneau « Top sources » + compteur utilisateurs/ressource.
- `lib/resources/mcp.ts` (modifier) — description de `get_stats`.
- `drizzle/0002_*.sql` (généré) — migration.

---

## Task 1: Schéma — colonnes d'attribution + migration

**Files:**
- Modify: `db/schema/stats.ts`
- Modify: `db/schema/access.ts`
- Generate: `drizzle/0002_*.sql`

- [ ] **Step 1: Ajouter les colonnes à `view_events`**

Dans `db/schema/stats.ts`, dans l'objet colonnes de `viewEvents`, après `type` :

```ts
    type: text("type").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
```

- [ ] **Step 2: Ajouter les colonnes à `subscriptions`**

Dans `db/schema/access.ts`, dans l'objet colonnes de `subscriptions`, après `resourceId` :

```ts
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
```

- [ ] **Step 3: Générer la migration**

Run: `npm run db:generate`
Expected: nouveau fichier `drizzle/0002_*.sql` avec `ALTER TABLE "view_events" ADD COLUMN ...` et idem `subscriptions`.

- [ ] **Step 4: Appliquer en local**

Run: `npm run db:push`
Expected: « Changes applied » / pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add db/schema/stats.ts db/schema/access.ts drizzle/
git commit -m "🗃️ Schéma : colonnes UTM (source/medium/campaign) sur view_events et subscriptions"
```

---

## Task 2: `lib/tracking/ref.ts` — parsing + cookie (logique pure, TDD)

**Files:**
- Create: `lib/tracking/ref.ts`
- Test: `lib/tracking/ref.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

```ts
import { describe, it, expect } from "vitest"
import { parseRefFromParams, serializeRefCookie, parseRefCookie, type Ref } from "./ref"

const params = (q: string) => new URLSearchParams(q)

describe("parseRefFromParams", () => {
  it("lit le trio UTM et normalise (trim, minuscules, longueur)", () => {
    expect(parseRefFromParams(params("utm_source=LinkedIn&utm_medium=Social&utm_campaign=Post-Auto"))).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "post-auto",
    })
  })

  it("accepte src comme alias de utm_source", () => {
    expect(parseRefFromParams(params("src=Newsletter"))).toEqual({ source: "newsletter", medium: null, campaign: null })
  })

  it("préfère utm_source à src si les deux sont présents", () => {
    expect(parseRefFromParams(params("utm_source=linkedin&src=ignored"))?.source).toBe("linkedin")
  })

  it("plafonne la longueur à 64 caractères", () => {
    const long = "a".repeat(100)
    expect(parseRefFromParams(params(`utm_source=${long}`))?.source).toHaveLength(64)
  })

  it("renvoie null si aucun paramètre exploitable", () => {
    expect(parseRefFromParams(params("foo=bar"))).toBeNull()
    expect(parseRefFromParams(params("utm_source=%20%20"))).toBeNull()
  })

  it("renvoie un ref même si seuls medium/campaign sont posés sans source", () => {
    expect(parseRefFromParams(params("utm_campaign=mai"))).toEqual({ source: null, medium: null, campaign: "mai" })
  })
})

describe("cookie aller-retour", () => {
  it("sérialise puis reparse à l'identique", () => {
    const ref: Ref = { source: "linkedin", medium: "social", campaign: "post-auto" }
    const parsed = parseRefCookie(serializeRefCookie(ref))
    expect(parsed).toEqual(ref)
  })

  it("parseRefCookie tolère une valeur absente ou invalide", () => {
    expect(parseRefCookie(undefined)).toBeNull()
    expect(parseRefCookie("pas-du-json")).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test (échoue)**

Run: `npx vitest run lib/tracking/ref.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `lib/tracking/ref.ts`**

```ts
export type Ref = { source: string | null; medium: string | null; campaign: string | null }

export const REF_COOKIE = "lab_ref"
export const REF_MAX_AGE = 60 * 60 * 24 * 90 // 90 jours

function norm(v: string | null): string | null {
  if (v === null) return null
  const s = v.trim().toLowerCase().slice(0, 64)
  return s.length ? s : null
}

export function parseRefFromParams(params: URLSearchParams): Ref | null {
  const source = norm(params.get("utm_source") ?? params.get("src"))
  const medium = norm(params.get("utm_medium"))
  const campaign = norm(params.get("utm_campaign"))
  if (!source && !medium && !campaign) return null
  return { source, medium, campaign }
}

export function serializeRefCookie(ref: Ref): string {
  return JSON.stringify({ s: ref.source, m: ref.medium, c: ref.campaign, t: new Date().toISOString() })
}

export function parseRefCookie(raw: string | undefined): Ref | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as { s?: unknown; m?: unknown; c?: unknown }
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : null)
    return { source: str(o.s), medium: str(o.m), campaign: str(o.c) }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Lancer le test (passe)**

Run: `npx vitest run lib/tracking/ref.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tracking/ref.ts lib/tracking/ref.test.ts
git commit -m "✨ Tracking : parsing UTM/src + cookie first-touch (logique pure)"
```

---

## Task 3: `middleware.ts` — pose du cookie first-touch

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Implémenter le middleware**

```ts
import { NextResponse, type NextRequest } from "next/server"
import { parseRefFromParams, serializeRefCookie, REF_COOKIE, REF_MAX_AGE } from "@/lib/tracking/ref"

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  if (req.cookies.has(REF_COOKIE)) return res // first-touch : ne pas écraser
  const ref = parseRefFromParams(req.nextUrl.searchParams)
  if (!ref) return res
  res.cookies.set(REF_COOKIE, serializeRefCookie(ref), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REF_MAX_AGE,
  })
  return res
}

export const config = { matcher: ["/r/:path*"] }
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "✨ Tracking : middleware pose le cookie first-touch sur /r/*"
```

---

## Task 4: Enregistrement — `record.ts` + `addSubscription` acceptent un `ref`

**Files:**
- Modify: `lib/stats/record.ts`
- Modify: `lib/content/queries.ts`

- [ ] **Step 1: `record.ts` — propager le trio**

Remplacer le contenu de `lib/stats/record.ts` par :

```ts
import { db } from "@/db"
import { viewEvents } from "@/db/schema"
import type { Ref } from "@/lib/tracking/ref"

const cols = (ref?: Ref | null) => ({
  source: ref?.source ?? null,
  medium: ref?.medium ?? null,
  campaign: ref?.campaign ?? null,
})

export async function recordPageView(resourceId: string, pageId: string, userId: string | null, ref?: Ref | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId, userId, type: "page_view", ...cols(ref) })
  } catch (e) {
    console.error("recordPageView:", (e as Error).message)
  }
}

export async function recordGateView(resourceId: string, userId: string | null, ref?: Ref | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId: null, userId, type: "gate_view", ...cols(ref) })
  } catch (e) {
    console.error("recordGateView:", (e as Error).message)
  }
}
```

- [ ] **Step 2: `addSubscription` — figer le trio à l'insert**

Dans `lib/content/queries.ts`, ajouter l'import en tête :

```ts
import type { Ref } from "@/lib/tracking/ref"
```

Remplacer `addSubscription` par :

```ts
export async function addSubscription(userId: string, resourceId: string, ref?: Ref | null) {
  await db
    .insert(subscriptions)
    .values({ userId, resourceId, source: ref?.source ?? null, medium: ref?.medium ?? null, campaign: ref?.campaign ?? null })
    .onConflictDoNothing()
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npm run typecheck`
Expected: erreurs attendues sur les appelants de `render.tsx` (corrigés en Task 5). Les signatures `ref` étant optionnelles, aucune erreur ici.

- [ ] **Step 4: Commit**

```bash
git add lib/stats/record.ts lib/content/queries.ts
git commit -m "✨ Tracking : record + addSubscription stockent l'attribution UTM"
```

---

## Task 5: Reader — lire le cookie, transmettre le `ref`

**Files:**
- Modify: `app/(public)/r/[slug]/render.tsx`

- [ ] **Step 1: Importer cookies + parser**

Après les imports existants, ajouter :

```ts
import { cookies } from "next/headers"
import { parseRefCookie, REF_COOKIE } from "@/lib/tracking/ref"
```

- [ ] **Step 2: Lire le ref une fois en tête de `renderResourcePage`**

Juste après `const h = await headers()` :

```ts
  const ref = parseRefCookie((await cookies()).get(REF_COOKIE)?.value)
```

- [ ] **Step 3: Transmettre le ref aux trois appels**

- `recordGateView(data.resource.id, session?.user.id ?? null)` → `recordGateView(data.resource.id, session?.user.id ?? null, ref)`
- `addSubscription(session.user.id, data.resource.id)` → `addSubscription(session.user.id, data.resource.id, ref)`
- `recordPageView(data.resource.id, page.id, session?.user.id ?? null)` → `recordPageView(data.resource.id, page.id, session?.user.id ?? null, ref)`

- [ ] **Step 4: Vérifier la compilation**

Run: `npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/r/[slug]/render.tsx"
git commit -m "✨ Tracking : le reader attache l'attribution first-touch aux événements"
```

---

## Task 6: `aggregate.ts` — ventilation par source (logique pure, TDD)

**Files:**
- Modify: `lib/stats/aggregate.ts`
- Modify: `lib/stats/aggregate.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

Ajouter dans `lib/stats/aggregate.test.ts` :

```ts
import { aggregateBySource } from "./aggregate"

describe("aggregateBySource", () => {
  const events = [
    { pageId: "root", userId: "u1", type: "page_view" as const, source: "linkedin", campaign: "post-a" },
    { pageId: "p1", userId: "u1", type: "page_view" as const, source: "linkedin", campaign: "post-a" },
    { pageId: null, userId: null, type: "gate_view" as const, source: "linkedin", campaign: "post-b" },
    { pageId: "root", userId: "u2", type: "page_view" as const, source: "newsletter", campaign: null },
    { pageId: "root", userId: "u3", type: "page_view" as const, source: null, campaign: null },
  ]
  const subs = [
    { userId: "u1", source: "linkedin", campaign: "post-a" },
    { userId: "u2", source: "newsletter", campaign: null },
    { userId: "u4", source: "linkedin", campaign: "post-b" },
  ]

  it("ventile vues, impressions gate et utilisateurs gagnés par source", () => {
    const rows = aggregateBySource(events, subs)
    const linkedin = rows.find((r) => r.source === "linkedin")!
    expect(linkedin.pageViews).toBe(2)
    expect(linkedin.gateImpressions).toBe(1)
    expect(linkedin.users).toBe(2) // u1 + u4
    const newsletter = rows.find((r) => r.source === "newsletter")!
    expect(newsletter.pageViews).toBe(1)
    expect(newsletter.users).toBe(1)
  })

  it("regroupe les événements sans source sous « (direct) »", () => {
    const rows = aggregateBySource(events, subs)
    expect(rows.find((r) => r.source === "(direct)")!.pageViews).toBe(1)
  })

  it("trie par utilisateurs gagnés décroissant", () => {
    const rows = aggregateBySource(events, subs)
    expect(rows[0].source).toBe("linkedin")
  })
})
```

- [ ] **Step 2: Lancer (échoue)**

Run: `npx vitest run lib/stats/aggregate.test.ts`
Expected: FAIL (`aggregateBySource` introuvable).

- [ ] **Step 3: Implémenter dans `lib/stats/aggregate.ts`**

Enrichir le type `ViewEvent` (ajouter les champs d'attribution, optionnels pour ne pas casser les tests existants) :

```ts
export type ViewEvent = {
  pageId: string | null
  userId: string | null
  type: "page_view" | "gate_view"
  source?: string | null
  medium?: string | null
  campaign?: string | null
}
```

Ajouter le type d'acquisition et la fonction en bas du fichier :

```ts
export type SubAttribution = { userId: string; source: string | null; medium?: string | null; campaign: string | null }

export type SourceRow = {
  source: string
  pageViews: number
  gateImpressions: number
  users: number
}

const DIRECT = "(direct)"

export function aggregateBySource(events: ViewEvent[], subs: SubAttribution[]): SourceRow[] {
  const rows = new Map<string, SourceRow>()
  const row = (s: string | null | undefined) => {
    const key = s ?? DIRECT
    let r = rows.get(key)
    if (!r) {
      r = { source: key, pageViews: 0, gateImpressions: 0, users: 0 }
      rows.set(key, r)
    }
    return r
  }
  for (const e of events) {
    const r = row(e.source)
    if (e.type === "page_view") r.pageViews++
    else if (e.type === "gate_view") r.gateImpressions++
  }
  const seen = new Set<string>()
  for (const s of subs) {
    const k = `${s.source ?? DIRECT}::${s.userId}`
    if (seen.has(k)) continue
    seen.add(k)
    row(s.source).users++
  }
  return [...rows.values()].sort((a, b) => b.users - a.users || b.pageViews - a.pageViews)
}
```

- [ ] **Step 4: Lancer (passe)**

Run: `npx vitest run lib/stats/aggregate.test.ts`
Expected: PASS (tous, anciens + nouveaux).

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregate.ts lib/stats/aggregate.test.ts
git commit -m "✨ Stats : agrégation par source (trafic + acquisition)"
```

---

## Task 7: `queries.ts` — enrichir `getResourceStats` et `getStatsOverview`

**Files:**
- Modify: `lib/stats/queries.ts`

- [ ] **Step 1: `getResourceStats` — lire l'attribution + ventiler**

Importer `subscriptions` et `aggregateBySource`/`SubAttribution` :

```ts
import { resources, pages, viewEvents, subscriptions } from "@/db/schema"
import { aggregateResourceStats, aggregateBySource, type ViewEvent, type StatPage, type SubAttribution } from "./aggregate"
```

Dans `getResourceStats`, étendre la sélection des `view_events` avec `source`/`campaign`, charger les subscriptions de la ressource, puis renvoyer `bySource`. Remplacer le bloc de sélection et le `return` :

```ts
  const rows = await db
    .select({ pageId: viewEvents.pageId, userId: viewEvents.userId, type: viewEvents.type, source: viewEvents.source, campaign: viewEvents.campaign })
    .from(viewEvents)
    .where(and(...conds))
  const events: ViewEvent[] = rows.map((r) => ({
    pageId: r.pageId,
    userId: r.userId,
    type: r.type as "page_view" | "gate_view",
    source: r.source,
    campaign: r.campaign,
  }))

  const subRows = await db
    .select({ userId: subscriptions.userId, source: subscriptions.source, campaign: subscriptions.campaign })
    .from(subscriptions)
    .where(eq(subscriptions.resourceId, resource.id))
  const subs: SubAttribution[] = subRows.map((s) => ({ userId: s.userId, source: s.source, campaign: s.campaign }))

  return {
    slug: resource.slug,
    title: resource.title,
    sinceDays: sinceDays ?? null,
    ...aggregateResourceStats(events, statPages),
    subscribers: subs.length,
    bySource: aggregateBySource(events, subs),
  }
```

- [ ] **Step 2: `getStatsOverview` — top sources global + subscribers/ressource**

Remplacer `getStatsOverview` par une version qui renvoie aussi `topSources` (global) et `subscribers` par ressource :

```ts
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

  const map = new Map<string, { slug: string; title: string; pageViews: number; gateImpressions: number; subscribers: number }>()
  for (const r of rows) {
    const cur = map.get(r.slug) ?? { slug: r.slug, title: r.title, pageViews: 0, gateImpressions: 0, subscribers: 0 }
    if (r.type === "page_view") cur.pageViews = r.count
    else if (r.type === "gate_view") cur.gateImpressions = r.count
    map.set(r.slug, cur)
  }

  const subRows = await db
    .select({ slug: resources.slug, source: subscriptions.source, count: sql<number>`cast(count(${subscriptions.id}) as int)` })
    .from(subscriptions)
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .groupBy(resources.slug, subscriptions.source)

  const sources = new Map<string, { source: string; users: number }>()
  for (const s of subRows) {
    const cur = map.get(s.slug)
    if (cur) cur.subscribers += s.count
    const key = s.source ?? "(direct)"
    const sc = sources.get(key) ?? { source: key, users: 0 }
    sc.users += s.count
    sources.set(key, sc)
  }

  return {
    resources: [...map.values()],
    topSources: [...sources.values()].sort((a, b) => b.users - a.users),
  }
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npm run typecheck`
Expected: erreurs attendues sur `app/admin/page.tsx` (consomme l'ancienne forme de `getStatsOverview`) — corrigées en Task 9.

- [ ] **Step 4: Commit**

```bash
git add lib/stats/queries.ts
git commit -m "✨ Stats : requêtes enrichies (bySource, topSources, subscribers)"
```

---

## Task 8: Admin ressource — section « Sources »

**Files:**
- Modify: `app/admin/r/[slug]/page.tsx`

- [ ] **Step 1: Ajouter la section après le bloc « Statistiques »**

Insérer, après la `<section>` Statistiques (avant la « Zone de danger ») :

```tsx
      <section className="border-2 border-ink bg-paper p-5 shadow-brutal sm:p-6">
        <SectionTitle>Sources</SectionTitle>
        {stats.bySource.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Aucune provenance encore. Ajoute <code className="font-mono">?utm_source=…&amp;utm_campaign=…</code> à tes liens.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">
                <th className="pb-2">Source</th>
                <th className="pb-2 text-right">Vues</th>
                <th className="pb-2 text-right">Gate</th>
                <th className="pb-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySource.map((s) => (
                <tr key={s.source} className="border-b border-ink/20">
                  <td className="py-1.5 font-bold">{s.source}</td>
                  <td className="py-1.5 text-right font-mono">{s.pageViews}</td>
                  <td className="py-1.5 text-right font-mono">{s.gateImpressions}</td>
                  <td className="py-1.5 text-right font-mono font-bold">{s.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
```

- [ ] **Step 2: Vérifier compilation + lint**

Run: `npm run typecheck && npm run lint`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/r/[slug]/page.tsx"
git commit -m "✨ Admin : section Sources sur la fiche ressource"
```

---

## Task 9: Admin dashboard — panneau « Top sources » + utilisateurs/ressource

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Adapter la consommation de `getStatsOverview`**

`overview` est désormais `{ resources, topSources }`. Mettre à jour :

```tsx
  const [resources, overview] = await Promise.all([listResources(), getStatsOverview()])
  const stat = (slug: string) => overview.resources.find((o) => o.slug === slug)
  const totalViews = overview.resources.reduce((a, o) => a + o.pageViews, 0)
  const totalGate = overview.resources.reduce((a, o) => a + o.gateImpressions, 0)
  const totalUsers = overview.resources.reduce((a, o) => a + o.subscribers, 0)
```

- [ ] **Step 2: Ajouter une KPI « Utilisateurs »**

Dans la grille de KPI, remplacer la carte « En avant » par « Utilisateurs » (ou ajouter une 5e ; garder 4 colonnes — on remplace `featured` par `Users` qui répond à la question métier) :

```tsx
        <Kpi icon={Users} label="Utilisateurs" value={totalUsers} />
```

Importer `Users` depuis `lucide-react` (et retirer `Star` s'il n'est plus utilisé après remplacement — vérifier les autres usages de `Star` dans le fichier ; il reste utilisé pour les badges featured de la liste, donc le garder).

- [ ] **Step 3: Afficher le compteur utilisateurs par ressource**

Dans la ligne de chaque ressource, sous le nombre de vues, ajouter les users :

```tsx
                  <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">
                    vues · {s?.gateImpressions ?? 0} gate · {s?.subscribers ?? 0} users
                  </div>
```

- [ ] **Step 4: Ajouter le panneau « Top sources »**

Après la section « Ressources », ajouter :

```tsx
      <section>
        <h2 className="mb-3 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">
          Top sources
        </h2>
        {overview.topSources.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Aucune provenance encore. Tague tes liens avec <code className="font-mono">?utm_source=…</code>.
          </p>
        ) : (
          <div className="divide-y-2 divide-ink border-2 border-ink shadow-brutal">
            {overview.topSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-4 bg-paper px-4 py-3">
                <span className="font-bold">{s.source}</span>
                <span className="font-mono text-sm">
                  <span className="text-lg font-black">{s.users}</span> users
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
```

- [ ] **Step 5: Vérifier compilation + lint**

Run: `npm run typecheck && npm run lint`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx
git commit -m "✨ Admin : KPI utilisateurs, users/ressource et panneau Top sources"
```

---

## Task 10: MCP — description de `get_stats`

**Files:**
- Modify: `lib/resources/mcp.ts:213`

- [ ] **Step 1: Mettre à jour la description**

Remplacer la chaîne de description de l'outil `get_stats` par :

```ts
    "Statistiques de vue et de provenance. Avec slug : détail d'une ressource (vues, visiteurs uniques, impressions gate, par page, utilisateurs débloqués, ventilation par source UTM). Sans slug : vue d'ensemble (par ressource + top sources d'acquisition).",
```

- [ ] **Step 2: Vérifier compilation**

Run: `npm run typecheck`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/resources/mcp.ts
git commit -m "📝 MCP : get_stats documente la ventilation par source"
```

---

## Task 11: Vérification finale

**Files:** aucun (contrôle).

- [ ] **Step 1: Suite complète**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tout passe.

- [ ] **Step 2: Vérification peuplée (base locale)**

Démarrer le dev, se connecter en admin (`npm run db:make-admin -- <email>` puis OTP), insérer quelques `view_events`/`subscriptions` synthétiques avec sources via un INSERT SQL ponctuel sur la base locale (port 5434), puis ouvrir `/admin` et `/admin/r/showcase` pour vérifier le rendu peuplé des sections « Sources » et « Top sources ». Vérifier aussi qu'un accès via `/r/<slug>?utm_source=test&utm_campaign=demo` pose bien le cookie `lab_ref` (DevTools) et que l'événement enregistré porte la source.

- [ ] **Step 3: Capture (optionnel)**

`DEV_LOG=/tmp/dev.log node scripts/shots.mjs login` puis `node scripts/shots.mjs shoot admin-sources`.

---

## Self-Review

- **Couverture spec :** convention liens (Task 2/3), first-touch cookie (Task 3), stockage 2 tables (Task 1/4), flux reader (Task 5), agrégation (Task 6), requêtes (Task 7), dashboards (Task 8/9), MCP (Task 10), tests + vérif (Task 2/6/11). ✓
- **Placeholders :** aucun ; tout le code est explicite.
- **Cohérence des types :** `Ref` (ref.ts) utilisé par record.ts, queries, middleware, render ; `ViewEvent` étendu avec champs optionnels (n'invalide pas les tests existants) ; `SourceRow`/`SubAttribution` définis en Task 6 et consommés en Task 7/8 ; `getStatsOverview` renvoie `{ resources, topSources }` consommé en Task 9.
