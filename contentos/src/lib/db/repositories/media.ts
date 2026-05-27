import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Media, media } from '../schema';

export type CreateMediaInput = {
  kind: 'image' | 'carousel' | 'video';
  assetKey: string;
  previewKey: string;
  width: number;
  height: number;
};

export type UpdateMediaPatch = Partial<Omit<CreateMediaInput, 'kind'>>;

export async function createMedia(
  userId: string,
  data: CreateMediaInput,
  id?: string,
): Promise<Media> {
  const finalId = id ?? createId();
  const [row] = await db
    .insert(media)
    .values({ id: finalId, userId, ...data })
    .returning();
  return row!;
}

export async function getMedia(userId: string, id: string): Promise<Media | undefined> {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listMedia(userId: string): Promise<Media[]> {
  return db.select().from(media).where(eq(media.userId, userId));
}

export async function updateMedia(
  userId: string,
  id: string,
  patch: UpdateMediaPatch,
): Promise<Media | undefined> {
  const rows = await db
    .update(media)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(media.id, id), eq(media.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteMedia(userId: string, id: string): Promise<void> {
  await db.delete(media).where(and(eq(media.id, id), eq(media.userId, userId)));
}
