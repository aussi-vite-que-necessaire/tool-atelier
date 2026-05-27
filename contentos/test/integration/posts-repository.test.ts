import { randomUUID } from 'node:crypto';
import { describe, expect, it, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createMedia } from '@/lib/db/repositories/media';
import {
  createPost,
  deletePost,
  getPost,
  getPostByGenerationJobId,
  listPosts,
  listPostsWithMedia,
  updatePost,
} from '@/lib/db/repositories/posts';
import { user } from '@/lib/db/schema';
import { createTestUser } from './helpers/seed';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('posts repository', () => {
  test('createPost insère une row avec defaults', async () => {
    await makeUser('u1', 'a@test.com');
    const post = await createPost('u1', { title: 'Mon titre', content: 'draft text' });
    expect(post.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(post.userId).toBe('u1');
    expect(post.title).toBe('Mon titre');
    expect(post.content).toBe('draft text');
    expect(post.status).toBe('draft');
    expect(post.mediaId).toBeNull();
  });

  test('getPost retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createPost('u1', { title: 'T', content: 'x' });
    const found = await getPost('u1', created.id);
    expect(found?.content).toBe('x');
  });

  test('listPosts retourne tous les posts du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createPost('u1', { title: 'T', content: 'a' });
    await createPost('u1', { title: 'T', content: 'b' });
    const rows = await listPosts('u1');
    expect(rows).toHaveLength(2);
  });

  test('updatePost modifie content et status', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createPost('u1', { title: 'T', content: 'old' });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePost('u1', created.id, {
      content: 'new',
      status: 'validated',
    });
    expect(updated?.content).toBe('new');
    expect(updated?.status).toBe('validated');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePost supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createPost('u1', { title: 'T', content: 'doomed' });
    await deletePost('u1', created.id);
    expect(await getPost('u1', created.id)).toBeUndefined();
  });
});

describe('listPosts ordering + generationJobId', () => {
  it('returns posts sorted by updated_at DESC', async () => {
    const userId = await createTestUser('lp-order');
    const p1 = await createPost(userId, { title: 'T', content: 'first' });
    await new Promise((r) => setTimeout(r, 10));
    const p2 = await createPost(userId, { title: 'T', content: 'second' });
    await new Promise((r) => setTimeout(r, 10));
    await updatePost(userId, p1.id, { content: 'first updated' });

    const list = await listPosts(userId);
    expect(list.map((p) => p.id)).toEqual([p1.id, p2.id]);
  });

  it('createPost accepts generationJobId and enforces UNIQUE constraint', async () => {
    const userId = await createTestUser('lp-unique');
    const jobKey = randomUUID();

    await createPost(userId, { title: 'T', content: 'first', generationJobId: jobKey });
    await expect(
      createPost(userId, { title: 'T', content: 'dup', generationJobId: jobKey }),
    ).rejects.toThrow();
  });
});

describe('listPostsWithMedia', () => {
  it('joint le visuel : url = assetKey + kind quand mediaId présent', async () => {
    const userId = await createTestUser('lpwm-media');
    const m = await createMedia(userId, {
      kind: 'image',
      assetKey: 'https://engine.test/img-abc.png',
      previewKey: 'prev-abc',
      width: 1200,
      height: 1200,
    });
    const post = await createPost(userId, { title: 'T', content: 'c', mediaId: m.id });

    const rows = await listPostsWithMedia(userId);
    const found = rows.find((r) => r.id === post.id);
    expect(found?.thumbnail).toEqual({ url: 'https://engine.test/img-abc.png', kind: 'image' });
  });

  it('thumbnail null quand le post n’a pas de média', async () => {
    const userId = await createTestUser('lpwm-nomedia');
    const post = await createPost(userId, { title: 'T', content: 'c' });

    const rows = await listPostsWithMedia(userId);
    expect(rows.find((r) => r.id === post.id)?.thumbnail).toBeNull();
  });

  it('ne retourne que les posts du user et trie par updated_at DESC', async () => {
    const me = await createTestUser('lpwm-me');
    const other = await createTestUser('lpwm-other');
    const p1 = await createPost(me, { title: 'T', content: 'first' });
    await new Promise((r) => setTimeout(r, 10));
    const p2 = await createPost(me, { title: 'T', content: 'second' });
    await createPost(other, { title: 'T', content: 'leak?' });

    const rows = await listPostsWithMedia(me);
    expect(rows.map((r) => r.id)).toEqual([p2.id, p1.id]);
  });
});

describe('getPostByGenerationJobId', () => {
  it('returns the post regardless of user (worker lookup)', async () => {
    const userId = await createTestUser('gpbgji');
    const jobKey = randomUUID();
    const created = await createPost(userId, {
      title: 'T',
      content: 'c',
      generationJobId: jobKey,
    });

    const found = await getPostByGenerationJobId(jobKey);
    expect(found?.id).toBe(created.id);
  });

  it('returns undefined for unknown jobKey', async () => {
    const found = await getPostByGenerationJobId(randomUUID());
    expect(found).toBeUndefined();
  });
});
