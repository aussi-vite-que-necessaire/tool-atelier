import type { Job } from 'bullmq';
import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia, getMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getVisualStyle } from '@/lib/db/repositories/visual-styles';
import { getMediaEngine } from '@/lib/media-engine';
import type { GenerateImageJob, GenerateImageResult } from '@/lib/queue/client';

export function makeProcessGenerateImage(_deps?: unknown) {
  return async function processGenerateImage(
    job: Job<GenerateImageJob>,
  ): Promise<GenerateImageResult> {
    const { userId, prompt, aspectRatio, styleId, sourceMediaId, postId } = job.data;
    const engine = getMediaEngine();

    let obj: Awaited<ReturnType<typeof engine.generate>>;
    let aiSourceKey: string | null = null;

    if (sourceMediaId) {
      // Édition image-to-image : on utilise le previewKey (engine id) comme sourceId.
      const source = await getMedia(userId, sourceMediaId);
      if (!source) throw new Error(`source media ${sourceMediaId} not found for user ${userId}`);
      // previewKey est l'id engine ; assetKey est l'URL publique.
      obj = await engine.edit({ sourceId: source.previewKey, prompt });
      aiSourceKey = source.assetKey;
    } else {
      let stylePrompt: string | null = null;
      if (styleId) {
        const style = await getVisualStyle(userId, styleId);
        stylePrompt = style?.prompt ?? null;
      }
      obj = await engine.generate({
        prompt,
        aspectRatio: aspectRatio ?? '1:1',
        stylePrompt,
      });
    }

    const mediaId = createId();
    await createMedia(
      userId,
      {
        kind: 'image',
        assetKey: obj.url,
        previewKey: obj.id,
        width: obj.width ?? 1024,
        height: obj.height ?? 1024,
      },
      mediaId,
    );
    await createImageAsset(userId, {
      mediaId,
      source: 'standalone',
      aiBrief: prompt,
      styleId: styleId ?? null,
      aiSourceKey,
    });

    if (postId) {
      const post = await getPost(userId, postId);
      if (post) await updatePost(userId, postId, { mediaId });
    }

    return { mediaId, url: obj.url, width: obj.width ?? 1024, height: obj.height ?? 1024 };
  };
}
