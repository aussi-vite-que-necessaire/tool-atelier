import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Post, posts } from '../schema';

export type CreatePostInput = {
  title: string;
  content: string;
  mediaId?: string | null;
  status?: 'draft' | 'validated';
  generationJobId?: string | null;
};

export type UpdatePostPatch = Partial<{
  title: string;
  content: string;
  status: 'draft' | 'validated';
  mediaId: string | null;
}>;

export async function createPost(userId: string, data: CreatePostInput): Promise<Post> {
  const id = createId();
  const [row] = await db
    .insert(posts)
    .values({
      id,
      userId,
      title: data.title,
      content: data.content,
      mediaId: data.mediaId ?? null,
      status: data.status ?? 'draft',
      generationJobId: data.generationJobId ?? null,
    })
    .returning();
  return row!;
}

export async function getPost(userId: string, id: string): Promise<Post | undefined> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPosts(userId: string): Promise<Post[]> {
  return db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.updatedAt));
}

export async function updatePost(
  userId: string,
  id: string,
  patch: UpdatePostPatch,
): Promise<Post | undefined> {
  const rows = await db
    .update(posts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePost(userId: string, id: string): Promise<void> {
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.userId, userId)));
}

/**
 * Lookup non-scopé par user_id : volontaire.
 * Utilisé pour retrouver un post via son jobKey (UUID v4 unique) en cas
 * de double-delivery BullMQ. Le jobKey est un capability token interne.
 * Ne JAMAIS exposer ce lookup via une route HTTP ou une Server Action.
 */
export async function getPostByGenerationJobId(jobKey: string): Promise<Post | undefined> {
  const rows = await db.select().from(posts).where(eq(posts.generationJobId, jobKey)).limit(1);
  return rows[0];
}
