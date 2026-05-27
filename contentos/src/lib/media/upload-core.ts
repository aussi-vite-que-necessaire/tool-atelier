import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { updatePost } from '@/lib/db/repositories/posts';
import { getMediaEngine } from '@/lib/media-engine';
import { validateUploadFile } from './validate-upload';

export async function uploadImageCore(
  userId: string,
  file: File,
  opts: { postId?: string } = {},
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const v = validateUploadFile({ type: file.type, size: file.size });
  if (!v.ok) return { status: 'error', message: v.message };

  const bytes = Buffer.from(await file.arrayBuffer());
  const obj = await getMediaEngine().upload({ bytes, contentType: file.type });

  const mediaId = createId();
  await createMedia(
    userId,
    {
      kind: 'image',
      assetKey: obj.url,
      previewKey: obj.id,
      width: obj.width ?? 0,
      height: obj.height ?? 0,
    },
    mediaId,
  );
  await createImageAsset(userId, { mediaId, source: 'standalone' });

  if (opts.postId) await updatePost(userId, opts.postId, { mediaId });
  return { status: 'success', mediaId };
}
