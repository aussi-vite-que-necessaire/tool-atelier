import { and, desc, eq } from 'drizzle-orm';
import type { CalendarPublication } from '@/lib/calendar/month-grid';
import { db } from '../client';
import { createId } from '../id';
import { media, type Publication, posts, publications } from '../schema';

type PublicationStatus = 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed';
type MediaKindValue = 'image' | 'carousel' | 'video';

export type CreatePublicationInput = {
  postId: string;
  contentSnapshot: string;
  platform: string;
  mediaKind?: MediaKindValue | null;
  snapshotKeys?: string[] | null;
  socialAccountId?: string | null;
  status?: PublicationStatus;
  scheduledFor?: Date | null;
  scheduledTz?: string | null;
};

export type UpdatePublicationPatch = Partial<{
  status: PublicationStatus;
  scheduledFor: Date | null;
  scheduledTz: string | null;
  publishedAt: Date | null;
  externalPostId: string | null;
  externalUrl: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  failureKind: string | null;
  lastError: string | null;
  socialAccountId: string | null;
  contentSnapshot: string;
  mediaKind: MediaKindValue | null;
  snapshotKeys: string[] | null;
}>;

export async function createPublication(
  userId: string,
  data: CreatePublicationInput,
): Promise<Publication> {
  const id = createId();
  const [row] = await db
    .insert(publications)
    .values({
      id,
      userId,
      postId: data.postId,
      contentSnapshot: data.contentSnapshot,
      platform: data.platform,
      mediaKind: data.mediaKind ?? null,
      snapshotKeys: data.snapshotKeys ?? null,
      socialAccountId: data.socialAccountId ?? null,
      status: data.status ?? 'scheduled',
      scheduledFor: data.scheduledFor ?? null,
      scheduledTz: data.scheduledTz ?? null,
    })
    .returning();
  return row!;
}

export async function getPublication(userId: string, id: string): Promise<Publication | undefined> {
  const rows = await db
    .select()
    .from(publications)
    .where(and(eq(publications.id, id), eq(publications.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPublications(userId: string): Promise<Publication[]> {
  return db.select().from(publications).where(eq(publications.userId, userId));
}

// Publications de l'utilisateur enrichies de la miniature image du post lié (URL publique
// assetKey si le post a une image, null sinon). Utilisé par la vue calendrier.
export async function listPublicationsForCalendar(userId: string): Promise<CalendarPublication[]> {
  const rows = await db
    .select({ publication: publications, assetKey: media.assetKey, kind: media.kind })
    .from(publications)
    .leftJoin(posts, eq(publications.postId, posts.id))
    .leftJoin(media, eq(posts.mediaId, media.id))
    .where(eq(publications.userId, userId));
  return rows.map((r) => ({
    ...r.publication,
    thumbnailUrl: r.kind === 'image' ? r.assetKey : null,
  }));
}

export async function getLatestPublicationForPost(
  userId: string,
  postId: string,
): Promise<Publication | undefined> {
  const rows = await db
    .select()
    .from(publications)
    .where(and(eq(publications.userId, userId), eq(publications.postId, postId)))
    .orderBy(desc(publications.createdAt))
    .limit(1);
  return rows[0];
}

export async function updatePublication(
  userId: string,
  id: string,
  patch: UpdatePublicationPatch,
): Promise<Publication | undefined> {
  const rows = await db
    .update(publications)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(publications.id, id), eq(publications.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePublication(userId: string, id: string): Promise<void> {
  await db
    .delete(publications)
    .where(and(eq(publications.id, id), eq(publications.userId, userId)));
}
