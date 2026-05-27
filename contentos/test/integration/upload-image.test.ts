import { describe, expect, test } from 'vitest';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { uploadImageCore } from '@/lib/media/upload-core';
import { createTestUser } from './helpers/seed';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function makeFile(type: string, bytes: Buffer): File {
  return new File([new Uint8Array(bytes)], 'test', { type });
}

describe('uploadImageCore', () => {
  test("crée une image standalone à partir d'un PNG", async () => {
    const userId = await createTestUser('up-ok');
    const r = await uploadImageCore(userId, makeFile('image/png', PNG_1x1));
    expect(r.status).toBe('success');
    const list = await listStandaloneImages(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.asset.source).toBe('standalone');
    expect(list[0]!.asset.aiBrief).toBeNull();
  });

  test('rejette un format non supporté', async () => {
    const userId = await createTestUser('up-bad');
    const r = await uploadImageCore(userId, makeFile('image/gif', PNG_1x1));
    expect(r.status).toBe('error');
  });

  test('attache au post si postId fourni', async () => {
    const userId = await createTestUser('up-post');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const r = await uploadImageCore(userId, makeFile('image/png', PNG_1x1), { postId: post.id });
    expect(r.status).toBe('success');
    if (r.status !== 'success') throw new Error();
    expect((await getPost(userId, post.id))?.mediaId).toBe(r.mediaId);
  });
});
