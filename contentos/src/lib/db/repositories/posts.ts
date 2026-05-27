import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { media, type Post, posts } from '../schema';
import type { MediaRef } from '@/lib/media-link/resolve';

export type PostThumbnail = { url: string; kind: 'image' | 'carousel' | 'video' };
export type PostWithThumbnail = Post & { thumbnail: PostThumbnail | null };

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

/**
 * Comme listPosts, mais joint le visuel attaché pour la vignette du listing.
 * `thumbnail.url` est une URL publique engine affichable telle quelle :
 * assetKey pour une image, previewKey (= 1re slide) pour un carrousel. Pour une
 * vidéo, assetKey est le fichier mp4 (pas une image) : l'UI affiche un repère.
 */
export async function listPostsWithMedia(userId: string): Promise<PostWithThumbnail[]> {
  const rows = await db
    .select({
      post: posts,
      mediaKind: media.kind,
      mediaAssetKey: media.assetKey,
      mediaPreviewKey: media.previewKey,
    })
    .from(posts)
    .leftJoin(media, eq(posts.mediaId, media.id))
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.updatedAt));

  return rows.map(({ post, mediaKind, mediaAssetKey, mediaPreviewKey }) => {
    if (!mediaKind) return { ...post, thumbnail: null };
    const url = mediaKind === 'carousel' ? mediaPreviewKey! : mediaAssetKey!;
    return { ...post, thumbnail: { url, kind: mediaKind } };
  });
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

export async function setPostMedia(
  userId: string,
  postId: string,
  ref: MediaRef,
): Promise<Post | undefined> {
  const rows = await db
    .update(posts)
    .set({
      mediaId: ref.media_id,
      mediaUrl: ref.media_url,
      mediaKind: ref.media_kind,
      mediaWidth: ref.media_width,
      mediaHeight: ref.media_height,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning();
  return rows[0];
}

export async function clearPostMedia(
  userId: string,
  postId: string,
): Promise<Post | undefined> {
  const rows = await db
    .update(posts)
    .set({
      mediaId: null,
      mediaUrl: null,
      mediaKind: null,
      mediaWidth: null,
      mediaHeight: null,
      updatedAt: new Date(),
    })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning();
  return rows[0];
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
