import { eq, and, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, modules, resourceAccess, subscriptions, audienceMembers, operators } from "@/db/schema"
import { parseModule, type ParsedModule } from "@/lib/modules/schemas"
import type { FlatPage } from "@/lib/content/tree"
import type { Ref } from "@/lib/tracking/ref"

// Ressources publiées & publiques d'un opérateur — pour son espace /o/<handle>.
export async function listPublishedResources(operatorId: string) {
  return db
    .select()
    .from(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.published, true), eq(resources.visibility, "public")))
    .orderBy(desc(resources.featured), desc(resources.createdAt))
}

export async function getResourceBySlug(operatorId: string, slug: string, includeUnpublished = false) {
  const [resource] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.slug, slug)))
    .limit(1)
  if (!resource || (!resource.published && !includeUnpublished)) return null

  const pageRows = await db.select().from(pages).where(eq(pages.resourceId, resource.id))
  const flatPages: FlatPage[] = pageRows.map((p) => ({
    id: p.id,
    parentId: p.parentId,
    slug: p.slug,
    title: p.title,
    position: p.position,
  }))
  return { resource, flatPages }
}

export async function getResourceMeta(operatorId: string, slug: string) {
  const [r] = await db
    .select({
      title: resources.title,
      description: resources.description,
      coverImageUrl: resources.coverImageUrl,
      published: resources.published,
    })
    .from(resources)
    .where(and(eq(resources.operatorId, operatorId), eq(resources.slug, slug)))
    .limit(1)
  return r ?? null
}

// Compat liens legacy /r/<slug> : retrouve le handle de l'opérateur propriétaire
// d'une ressource par son slug (les slugs étaient globalement uniques avant la
// bascule multi-tenant). Renvoie null si aucune ressource ne porte ce slug.
export async function resolveLegacySlug(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ handle: operators.handle })
    .from(resources)
    .innerJoin(operators, eq(resources.operatorId, operators.id))
    .where(eq(resources.slug, slug))
    .limit(1)
  return row?.handle ?? null
}

export async function getGrantedEmails(resourceId: string): Promise<string[]> {
  const rows = await db
    .select({ email: resourceAccess.email })
    .from(resourceAccess)
    .where(eq(resourceAccess.resourceId, resourceId))
  return rows.map((r) => r.email)
}

export async function getPageModules(pageId: string): Promise<ParsedModule[]> {
  const rows = await db.select().from(modules).where(eq(modules.pageId, pageId)).orderBy(asc(modules.position))
  return rows
    .map((r) => parseModule({ id: r.id, type: r.type, position: r.position, content: r.content }))
    .filter((m): m is ParsedModule => m !== null)
}

export async function addSubscription(userId: string, resourceId: string, ref?: Ref | null) {
  await db
    .insert(subscriptions)
    .values({ userId, resourceId, source: ref?.source ?? null, medium: ref?.medium ?? null, campaign: ref?.campaign ?? null })
    .onConflictDoNothing()
}

export async function removeSubscription(userId: string, resourceId: string) {
  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.resourceId, resourceId)))
}

// Abonnements d'un lecteur, avec le handle de l'opérateur (lien /o/<handle>/r/<slug>).
export async function listSubscriptions(userId: string) {
  return db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      description: resources.description,
      coverImageUrl: resources.coverImageUrl,
      operatorHandle: operators.handle,
    })
    .from(subscriptions)
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .innerJoin(operators, eq(resources.operatorId, operators.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
}

// Rattache un membre d'audience à un opérateur (idempotent), à la 1ʳᵉ lecture.
export async function upsertAudienceMember(operatorId: string, userId: string, ref?: Ref | null) {
  await db
    .insert(audienceMembers)
    .values({
      operatorId,
      userId,
      source: ref?.source ?? null,
      medium: ref?.medium ?? null,
      campaign: ref?.campaign ?? null,
    })
    .onConflictDoNothing()
}

// Audience d'un opérateur (membres rattachés), du plus récent au plus ancien.
export async function listAudience(operatorId: string) {
  return db
    .select({
      userId: audienceMembers.userId,
      source: audienceMembers.source,
      campaign: audienceMembers.campaign,
      createdAt: audienceMembers.createdAt,
    })
    .from(audienceMembers)
    .where(eq(audienceMembers.operatorId, operatorId))
    .orderBy(desc(audienceMembers.createdAt))
}
