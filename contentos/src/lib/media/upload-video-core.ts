import { createId } from '@/lib/db/id';
import { createMedia } from '@/lib/db/repositories/media';
import { updatePost } from '@/lib/db/repositories/posts';
import { getMediaEngine } from '@/lib/media-engine';
import { validateVideoFile } from './validate-upload';

export async function uploadVideoCore(
  userId: string,
  file: File,
  opts: { postId?: string } = {},
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const v = validateVideoFile({ type: file.type, size: file.size });
  if (!v.ok) return { status: 'error', message: v.message };

  const bytes = Buffer.from(await file.arrayBuffer());
  const obj = await getMediaEngine().upload({ bytes, contentType: file.type });

  const mediaId = createId();
  // width/height inconnus pour la vidéo → 0, non utilisés.
  await createMedia(
    userId,
    { kind: 'video', assetKey: obj.url, previewKey: obj.id, width: 0, height: 0 },
    mediaId,
  );

  if (opts.postId) await updatePost(userId, opts.postId, { mediaId });
  return { status: 'success', mediaId };
}
