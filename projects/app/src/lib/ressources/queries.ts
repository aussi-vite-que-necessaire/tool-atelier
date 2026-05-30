import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  resAccess,
  resAudience,
  resModules,
  resPages,
  resResources,
  resSettings,
  resSubscriptions,
  resViewEvents,
} from '@/lib/db/schema';
import { type ParsedModule, parseModule } from './module-schemas';
import type { Ref } from './tracking';
import type { FlatPage } from './tree';

// Ressources publiées & publiques d'un opérateur — pour son espace /docs/<handle>.
export async function listPublishedResources(userId: string) {
  return db
    .select()
    .from(resResources)
    .where(
      and(
        eq(resResources.userId, userId),
        eq(resResources.published, true),
        eq(resResources.visibility, 'public'),
      ),
    )
    .orderBy(desc(resResources.featured), desc(resResources.createdAt));
}

export async function getResourceBySlug(userId: string, slug: string, includeUnpublished = false) {
  const [resource] = await db
    .select()
    .from(resResources)
    .where(and(eq(resResources.userId, userId), eq(resResources.slug, slug)))
    .limit(1);
  if (!resource || (!resource.published && !includeUnpublished)) return null;

  const pageRows = await db.select().from(resPages).where(eq(resPages.resourceId, resource.id));
  const flatPages: FlatPage[] = pageRows.map((p) => ({
    id: p.id,
    parentId: p.parentId,
    slug: p.slug,
    title: p.title,
    position: p.position,
  }));
  return { resource, flatPages };
}

export async function getResourceMeta(userId: string, slug: string) {
  const [r] = await db
    .select({
      title: resResources.title,
      description: resResources.description,
      coverImageUrl: resResources.coverImageUrl,
      published: resResources.published,
    })
    .from(resResources)
    .where(and(eq(resResources.userId, userId), eq(resResources.slug, slug)))
    .limit(1);
  return r ?? null;
}

export async function getGrantedEmails(resourceId: string): Promise<string[]> {
  const rows = await db
    .select({ email: resAccess.email })
    .from(resAccess)
    .where(eq(resAccess.resourceId, resourceId));
  return rows.map((r) => r.email);
}

export async function getPageModules(pageId: string): Promise<ParsedModule[]> {
  const rows = await db
    .select()
    .from(resModules)
    .where(eq(resModules.pageId, pageId))
    .orderBy(asc(resModules.position));
  return rows
    .map((r) => parseModule({ id: r.id, type: r.type, position: r.position, content: r.content }))
    .filter((m): m is ParsedModule => m !== null);
}

export async function addSubscription(readerId: string, resourceId: string, ref?: Ref | null) {
  await db
    .insert(resSubscriptions)
    .values({
      readerId,
      resourceId,
      source: ref?.source ?? null,
      medium: ref?.medium ?? null,
      campaign: ref?.campaign ?? null,
    })
    .onConflictDoNothing();
}

// Rattache un membre d'audience à un opérateur (idempotent), à la 1ʳᵉ lecture.
export async function upsertAudienceMember(userId: string, readerId: string, ref?: Ref | null) {
  await db
    .insert(resAudience)
    .values({
      userId,
      readerId,
      source: ref?.source ?? null,
      medium: ref?.medium ?? null,
      campaign: ref?.campaign ?? null,
    })
    .onConflictDoNothing();
}

// Audience d'un opérateur (membres rattachés), du plus récent au plus ancien.
export async function listAudience(userId: string) {
  return db
    .select({
      readerId: resAudience.readerId,
      source: resAudience.source,
      campaign: resAudience.campaign,
      createdAt: resAudience.createdAt,
    })
    .from(resAudience)
    .where(eq(resAudience.userId, userId))
    .orderBy(desc(resAudience.createdAt));
}

const eventCols = (ref?: Ref | null) => ({
  source: ref?.source ?? null,
  medium: ref?.medium ?? null,
  campaign: ref?.campaign ?? null,
});

export async function recordPageView(
  resourceId: string,
  pageId: string,
  readerId: string | null,
  ref?: Ref | null,
) {
  try {
    await db
      .insert(resViewEvents)
      .values({ resourceId, pageId, readerId, type: 'page_view', ...eventCols(ref) });
  } catch (e) {
    console.error('recordPageView:', (e as Error).message);
  }
}

export async function recordGateView(
  resourceId: string,
  readerId: string | null,
  ref?: Ref | null,
) {
  try {
    await db
      .insert(resViewEvents)
      .values({ resourceId, pageId: null, readerId, type: 'gate_view', ...eventCols(ref) });
  } catch (e) {
    console.error('recordGateView:', (e as Error).message);
  }
}

// Compat liens /docs/r/<slug> : retrouve le handle de l'opérateur propriétaire
// d'une ressource par son slug. Renvoie null si aucune ressource ne porte ce slug.
export async function resolveSlugToHandle(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ handle: resSettings.handle })
    .from(resResources)
    .innerJoin(resSettings, eq(resResources.userId, resSettings.userId))
    .where(eq(resResources.slug, slug))
    .limit(1);
  return row?.handle ?? null;
}
