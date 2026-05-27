import { deleteMedia, getMedia } from '@/lib/db/repositories/media';

export async function deleteImageCore(
  userId: string,
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const m = await getMedia(userId, mediaId);
  if (!m) return { status: 'error', message: 'Image introuvable' };
  // Cascade delete sur image_assets ; posts.media_id → null via FK SET NULL.
  await deleteMedia(userId, mediaId);
  return { status: 'success' };
}
