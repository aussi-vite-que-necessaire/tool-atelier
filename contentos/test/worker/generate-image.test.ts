import type { Job } from 'bullmq';
import { describe, expect, test } from 'vitest';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { GenerateImageJob } from '@/lib/queue/client';
import { makeProcessGenerateImage } from '@/worker/queues/generate-image';
import { createTestUser } from '../integration/helpers/seed';

function makeJob(data: GenerateImageJob): Job<GenerateImageJob> {
  return { data } as unknown as Job<GenerateImageJob>;
}

describe('processGenerateImage', () => {
  test('crée une image standalone avec aiBrief', async () => {
    const userId = await createTestUser('gi-ok');
    const handler = makeProcessGenerateImage();

    const res = await handler(
      makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', jobKey: 'g1' }),
    );
    expect(res.mediaId).toBeDefined();
    // assetKey = URL publique engine (memory:// en stub)
    expect(res.url).toMatch(/^memory:\/\//);
    const list = await listStandaloneImages(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.asset.aiBrief).toBe('un chat');
    // assetKey du media = URL engine
    expect(list[0]!.media.assetKey).toMatch(/^memory:\/\//);
  });

  test('charge le style si styleId fourni', async () => {
    const userId = await createTestUser('gi-style');
    const style = await createVisualStyle(userId, { name: 'Flat', prompt: 'flat design' });
    const handler = makeProcessGenerateImage();

    await handler(
      makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', styleId: style!.id, jobKey: 'g2' }),
    );
    // Vérifie que le style est enregistré dans image_assets
    const list = await listStandaloneImages(userId);
    expect(list[0]!.asset.styleId).toBe(style!.id);
  });

  test('attache au post si postId fourni', async () => {
    const userId = await createTestUser('gi-post');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const handler = makeProcessGenerateImage();

    const res = await handler(
      makeJob({ userId, prompt: 'x', aspectRatio: '1:1', postId: post.id, jobKey: 'g3' }),
    );
    expect((await getPost(userId, post.id))?.mediaId).toBe(res.mediaId);
  });

  test('avec sourceMediaId : édition image-to-image via engine.edit', async () => {
    const userId = await createTestUser('gi-edit');
    // Crée un media source avec previewKey = engine id (simulé avec une valeur UUID-like).
    // Le stub InMemoryMediaEngine.edit vérifie que la source existe dans son store.
    // On passe par engine.generate d'abord pour obtenir un vrai id du stub.
    const handler = makeProcessGenerateImage();
    // Génère la source d'abord
    const src = await handler(
      makeJob({ userId, prompt: 'source', aspectRatio: '1:1', jobKey: 'src' }),
    );

    // Édition à partir du mediaId source
    const res = await handler(
      makeJob({ userId, prompt: 'rends-le bleu', sourceMediaId: src.mediaId, jobKey: 'ge1' }),
    );
    expect(res.mediaId).toBeDefined();
    expect(await getMedia(userId, res.mediaId)).toBeDefined();
    const list = await listStandaloneImages(userId);
    // 2 images : la source + l'éditée
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  test('sans sourceMediaId : génération texte→image', async () => {
    const userId = await createTestUser('gi-txt');
    const handler = makeProcessGenerateImage();
    const res = await handler(
      makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', jobKey: 'ge2' }),
    );
    expect(res.url).toMatch(/^memory:\/\//);
  });

  test('previewKey = engine id, assetKey = engine URL', async () => {
    const userId = await createTestUser('gi-convention');
    const handler = makeProcessGenerateImage();
    const res = await handler(
      makeJob({ userId, prompt: 'test convention', aspectRatio: '1:1', jobKey: 'gc1' }),
    );
    const m = await getMedia(userId, res.mediaId);
    // assetKey = URL publique (memory://...)
    expect(m?.assetKey).toMatch(/^memory:\/\//);
    // previewKey = engine id (UUID sans préfixe)
    expect(m?.previewKey).toBeDefined();
    expect(m?.previewKey).not.toMatch(/^memory:\/\//);
  });
});
