import { describe, expect, test } from 'vitest';
import { getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { uploadVideoCore } from '@/lib/media/upload-video-core';
import { createTestUser } from './helpers/seed';

function videoFile(type: string, size: number): File {
  return {
    type,
    size,
    arrayBuffer: async () => new Uint8Array(Math.max(1, Math.min(size, 16))).buffer,
  } as unknown as File;
}

describe('uploadVideoCore', () => {
  test('mp4 valide → media video attaché au post', async () => {
    const userId = await createTestUser('vid');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const r = await uploadVideoCore(userId, videoFile('video/mp4', 1024), { postId: post.id });
    expect(r.status).toBe('success');
    if (r.status !== 'success') return;
    expect((await getMedia(userId, r.mediaId))?.kind).toBe('video');
    expect((await getPost(userId, post.id))?.mediaId).toBe(r.mediaId);
  });

  test('type non-mp4 → erreur', async () => {
    const userId = await createTestUser('vid-bad');
    const r = await uploadVideoCore(userId, videoFile('video/quicktime', 1024));
    expect(r.status).toBe('error');
  });

  test('trop lourd → erreur', async () => {
    const userId = await createTestUser('vid-big');
    const r = await uploadVideoCore(userId, videoFile('video/mp4', 600 * 1024 * 1024));
    expect(r.status).toBe('error');
  });
});
