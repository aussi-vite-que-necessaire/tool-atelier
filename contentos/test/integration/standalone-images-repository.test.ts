import { describe, expect, test } from 'vitest';
import { createImageAsset, listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { createTestUser } from './helpers/seed';

async function makeStandalone(userId: string, aiBrief: string | null = null) {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: `k-${Math.random()}`,
    previewKey: 'k',
    width: 100,
    height: 100,
  });
  await createImageAsset(userId, { mediaId: m.id, source: 'standalone', aiBrief });
  return m;
}

describe('listStandaloneImages', () => {
  test('ne renvoie que les images standalone du bon user', async () => {
    const a = await createTestUser('si-a');
    const b = await createTestUser('si-b');
    await makeStandalone(a, 'prompt A');
    await makeStandalone(b, 'prompt B');

    const tmplMedia = await createMedia(a, {
      kind: 'image',
      assetKey: 'tmpl',
      previewKey: 'tmpl',
      width: 1,
      height: 1,
    });
    await createImageAsset(a, { mediaId: tmplMedia.id, source: 'template', templateSlug: 'x' });

    const listA = await listStandaloneImages(a);
    expect(listA).toHaveLength(1);
    expect(listA[0]!.asset.source).toBe('standalone');
    expect(listA[0]!.asset.aiBrief).toBe('prompt A');
    expect(await listStandaloneImages(b)).toHaveLength(1);
  });
});
