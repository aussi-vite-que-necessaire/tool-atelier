import { eq, and, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, modules, resourceAccess, subscriptions } from "@/db/schema"
import { parseModule, type ParsedModule } from "@/lib/modules/schemas"
import type { FlatPage } from "@/lib/content/tree"
import type { Ref } from "@/lib/tracking/ref"

export async function listFeaturedResources() {
  return db
    .select()
    .from(resources)
    .where(and(eq(resources.published, true), eq(resources.visibility, "public"), eq(resources.featured, true)))
    .orderBy(desc(resources.createdAt))
}

export async function getResourceBySlug(slug: string, includeUnpublished = false) {
  const [resource] = await db.select().from(resources).where(eq(resources.slug, slug)).limit(1)
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

export async function listSubscriptions(userId: string) {
  return db
    .select({
      id: resources.id,
      slug: resources.slug,
      title: resources.title,
      description: resources.description,
      coverImageUrl: resources.coverImageUrl,
    })
    .from(subscriptions)
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
}
