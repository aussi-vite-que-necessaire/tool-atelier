import { eq, and, gte, sql } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, viewEvents, subscriptions } from "@/db/schema"
import { buildPageTree, type TreePage } from "@/lib/content/tree"
import { aggregateResourceStats, aggregateBySource, type ViewEvent, type StatPage, type SubAttribution } from "./aggregate"

export async function getResourceStats(operatorId: string, slug: string, sinceDays?: number) {
  const [resource] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.slug, slug)))
    .limit(1)
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
}

export async function getStatsOverview(operatorId: string) {
  const rows = await db
    .select({
      slug: resources.slug,
      title: resources.title,
      type: viewEvents.type,
      count: sql<number>`cast(count(${viewEvents.id}) as int)`,
    })
    .from(resources)
    .leftJoin(viewEvents, eq(viewEvents.resourceId, resources.id))
    .where(eq(resources.operatorId, operatorId))
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
    .where(eq(resources.operatorId, operatorId))
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
