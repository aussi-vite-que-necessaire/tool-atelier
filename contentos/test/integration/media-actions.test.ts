import { describe, expect, test } from 'vitest';
import { deleteImageCore } from '@/app/(app)/media/actions-core';
import { editImageGuard } from '@/app/(app)/media/edit-image-core';
import { attachExistingMediaCore } from '@/app/(app)/posts/[id]/media-actions-core';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia, getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers/seed';

async function makeStandalone(userId: string) {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: `k-${Math.random()}`,
    previewKey: 'k',
    width: 10,
    height: 10,
  });
  await createImageAsset(userId, { mediaId: m.id, source: 'standalone' });
  return m;
}

describe('attachExistingMediaCore', () => {
  test('attache un media de la galerie au post', async () => {
    const userId = await createTestUser('aem-ok');
    const m = await makeStandalone(userId);
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const r = await attachExistingMediaCore(userId, post.id, m.id);
    expect(r.status).toBe('success');
    expect((await getPost(userId, post.id))?.mediaId).toBe(m.id);
  });

  test("refuse un media d'un autre user", async () => {
    const a = await createTestUser('aem-a');
    const b = await createTestUser('aem-b');
    const m = await makeStandalone(a);
    const post = await createPost(b, { title: 'T', content: 'c' });
    const r = await attachExistingMediaCore(b, post.id, m.id);
    expect(r.status).toBe('error');
  });
});

describe('deleteImageCore', () => {
  test('supprime le media ; les posts référents passent à media_id null', async () => {
    const userId = await createTestUser('di-ok');
    const m = await makeStandalone(userId);
    const post = await createPost(userId, { title: 'T', content: 'c', mediaId: m.id });
    const r = await deleteImageCore(userId, m.id);
    expect(r.status).toBe('success');
    expect(await getMedia(userId, m.id)).toBeUndefined();
    expect((await getPost(userId, post.id))?.mediaId).toBeNull();
  });
});

describe('editImageGuard', () => {
  test('prompt vide rejeté', async () => {
    const userId = await createTestUser('eg-empty');
    expect((await editImageGuard(userId, { mediaId: 'x', prompt: '  ' })).ok).toBe(false);
  });
  test("image d'un autre user rejetée", async () => {
    const a = await createTestUser('eg-a');
    const b = await createTestUser('eg-b');
    const m = await makeStandalone(a);
    expect((await editImageGuard(b, { mediaId: m.id, prompt: 'x' })).ok).toBe(false);
  });
  test('ok si image possédée + prompt', async () => {
    const userId = await createTestUser('eg-ok');
    const m = await makeStandalone(userId);
    expect((await editImageGuard(userId, { mediaId: m.id, prompt: 'bleu' })).ok).toBe(true);
  });
});
