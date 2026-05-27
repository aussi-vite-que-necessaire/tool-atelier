import { getMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';

export async function attachExistingMediaCore(
  userId: string,
  postId: string,
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const media = await getMedia(userId, mediaId);
  if (!media) return { status: 'error', message: 'Image introuvable' };
  const post = await getPost(userId, postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  await updatePost(userId, postId, { mediaId });
  return { status: 'success' };
}
