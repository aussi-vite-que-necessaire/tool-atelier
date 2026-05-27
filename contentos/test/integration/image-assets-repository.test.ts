import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createImageAsset,
  deleteImageAsset,
  getImageAsset,
  updateImageAsset,
} from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

async function makeMediaForUser(userId: string): Promise<string> {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: 'k',
    previewKey: 'k',
    width: 1080,
    height: 1080,
  });
  return m.id;
}

describe('image_assets repository', () => {
  test('createImageAsset insère une row standalone', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    const asset = await createImageAsset('u1', { mediaId, source: 'standalone' });
    expect(asset.mediaId).toBe(mediaId);
    expect(asset.source).toBe('standalone');
    expect(asset.templateSlug).toBeNull();
    expect(asset.vars).toBeNull();
  });

  test('createImageAsset insère une row template avec vars', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    const asset = await createImageAsset('u1', {
      mediaId,
      source: 'template',
      templateSlug: 'linkedin-quote',
      vars: { title: 'hello' },
      aiBrief: 'a quote layout',
    });
    expect(asset.source).toBe('template');
    expect(asset.templateSlug).toBe('linkedin-quote');
    expect(asset.vars).toEqual({ title: 'hello' });
    expect(asset.aiBrief).toBe('a quote layout');
  });

  test('getImageAsset retourne la row si le media appartient au user', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    const found = await getImageAsset('u1', mediaId);
    expect(found?.source).toBe('standalone');
  });

  test('updateImageAsset modifie les champs', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    const updated = await updateImageAsset('u1', mediaId, {
      aiBrief: 'new brief',
      vars: { title: 'changed' },
    });
    expect(updated?.aiBrief).toBe('new brief');
    expect(updated?.vars).toEqual({ title: 'changed' });
  });

  test('deleteImageAsset supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    await deleteImageAsset('u1', mediaId);
    expect(await getImageAsset('u1', mediaId)).toBeUndefined();
  });
});
