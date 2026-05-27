import { describe, expect, test } from 'vitest';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { attachMediaTool, detachMediaTool } from '@/lib/mcp/tools/media';
import { createTestUser } from './helpers/seed';

describe('mcp tools — médias', () => {
  test('attach par URL puis detach', async () => {
    const userId = await createTestUser('mcpmedia');
    const post = await createPost(userId, { title: 'T', content: 'c' });

    await attachMediaTool(userId, {
      postId: post.id,
      mediaUrl: 'https://cdn.example/x.png',
    });
    const attached = await getPost(userId, post.id);
    expect(attached?.mediaUrl).toBe('https://cdn.example/x.png');
    expect(attached?.mediaKind).toBe('image');
    expect(attached?.mediaId).toBeNull();

    await detachMediaTool(userId, { postId: post.id });
    const detached = await getPost(userId, post.id);
    expect(detached?.mediaUrl).toBeNull();
    expect(detached?.mediaKind).toBeNull();
  });

  test('attach échoue sans media_id ni media_url', async () => {
    const userId = await createTestUser('mcpmedia2');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    await expect(attachMediaTool(userId, { postId: post.id })).rejects.toThrow(/requis/);
  });
});
