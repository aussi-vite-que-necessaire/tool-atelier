import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { resPages, resResources, resSubscriptions, resViewEvents } from '@/lib/db/schema';
import {
  aggregateBySource,
  aggregateResourceStats,
  type StatPage,
  type SubAttribution,
  type ViewEvent,
} from './stats-aggregate';
import { buildPageTree, type TreePage } from './tree';

export async function getResourceStats(userId: string, slug: string, sinceDays?: number) {
  const [resource] = await db
    .select()
    .from(resResources)
    .where(and(eq(resResources.userId, userId), eq(resResources.slug, slug)))
    .limit(1);
  if (!resource) throw new Error(`Ressource introuvable: ${slug}`);

  const pageRows = await db.select().from(resPages).where(eq(resPages.resourceId, resource.id));
  const root = buildPageTree(
    pageRows.map((p) => ({
      id: p.id,
      parentId: p.parentId,
      slug: p.slug,
      title: p.title,
      position: p.position,
    })),
  );
  const statPages: StatPage[] = [];
  if (root) {
    const walk = (n: TreePage, path: string[]) => {
      statPages.push({ id: n.id, title: n.title, path });
      for (const c of n.children) walk(c, [...path, c.slug]);
    };
    walk(root, []);
  }

  const conds = [eq(resViewEvents.resourceId, resource.id)];
  if (sinceDays)
    conds.push(gte(resViewEvents.createdAt, new Date(Date.now() - sinceDays * 86400000)));
  const rows = await db
    .select({
      pageId: resViewEvents.pageId,
      readerId: resViewEvents.readerId,
      type: resViewEvents.type,
      source: resViewEvents.source,
      campaign: resViewEvents.campaign,
    })
    .from(resViewEvents)
    .where(and(...conds));
  const events: ViewEvent[] = rows.map((r) => ({
    pageId: r.pageId,
    readerId: r.readerId,
    type: r.type as 'page_view' | 'gate_view',
    source: r.source,
    campaign: r.campaign,
  }));

  const subRows = await db
    .select({
      readerId: resSubscriptions.readerId,
      source: resSubscriptions.source,
      campaign: resSubscriptions.campaign,
    })
    .from(resSubscriptions)
    .where(eq(resSubscriptions.resourceId, resource.id));
  const subs: SubAttribution[] = subRows.map((s) => ({
    readerId: s.readerId,
    source: s.source,
    campaign: s.campaign,
  }));

  return {
    slug: resource.slug,
    title: resource.title,
    sinceDays: sinceDays ?? null,
    ...aggregateResourceStats(events, statPages),
    subscribers: subs.length,
    bySource: aggregateBySource(events, subs),
  };
}

export async function getStatsOverview(userId: string) {
  const rows = await db
    .select({
      slug: resResources.slug,
      title: resResources.title,
      type: resViewEvents.type,
      count: sql<number>`cast(count(${resViewEvents.id}) as int)`,
    })
    .from(resResources)
    .leftJoin(resViewEvents, eq(resViewEvents.resourceId, resResources.id))
    .where(eq(resResources.userId, userId))
    .groupBy(resResources.slug, resResources.title, resViewEvents.type);

  const map = new Map<
    string,
    { slug: string; title: string; pageViews: number; gateImpressions: number; subscribers: number }
  >();
  for (const r of rows) {
    const cur = map.get(r.slug) ?? {
      slug: r.slug,
      title: r.title,
      pageViews: 0,
      gateImpressions: 0,
      subscribers: 0,
    };
    if (r.type === 'page_view') cur.pageViews = r.count;
    else if (r.type === 'gate_view') cur.gateImpressions = r.count;
    map.set(r.slug, cur);
  }

  const subRows = await db
    .select({
      slug: resResources.slug,
      source: resSubscriptions.source,
      count: sql<number>`cast(count(${resSubscriptions.id}) as int)`,
    })
    .from(resSubscriptions)
    .innerJoin(resResources, eq(resSubscriptions.resourceId, resResources.id))
    .where(eq(resResources.userId, userId))
    .groupBy(resResources.slug, resSubscriptions.source);

  const sources = new Map<string, { source: string; users: number }>();
  for (const s of subRows) {
    const cur = map.get(s.slug);
    if (cur) cur.subscribers += s.count;
    const key = s.source ?? '(direct)';
    const sc = sources.get(key) ?? { source: key, users: 0 };
    sc.users += s.count;
    sources.set(key, sc);
  }

  return {
    resources: [...map.values()],
    topSources: [...sources.values()].sort((a, b) => b.users - a.users),
  };
}
