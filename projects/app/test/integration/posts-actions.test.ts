import { describe, expect, it } from 'vitest';
import { createPostCore, deletePostCore, updatePostCore } from '@/app/(app)/cast/posts/actions-core';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers/seed';

describe('createPostCore', () => {
  it('crée un post avec titre et contenu vide', async () => {
    const userId = await createTestUser('pc-create');
    const res = await createPostCore(userId, { title: 'Mon titre' });
    expect(res.status).toBe('success');
    if (res.status !== 'success') throw new Error('attendu success');
    const post = await getPost(userId, res.postId);
    expect(post?.title).toBe('Mon titre');
    expect(post?.content).toBe('');
  });

  it('refuse un titre vide', async () => {
    const userId = await createTestUser('pc-empty');
    const res = await createPostCore(userId, { title: '   ' });
    expect(res.status).toBe('error');
  });
});

describe('updatePostCore', () => {
  it('update content', async () => {
    const userId = await createTestUser('pu-content');
    const post = await createPost(userId, { title: 'T', content: 'old' });
    const r = await updatePostCore(userId, { id: post.id, content: 'new' });
    expect(r.status).toBe('success');
    expect((await getPost(userId, post.id))?.content).toBe('new');
  });

  it('update title', async () => {
    const userId = await createTestUser('pu-title');
    const post = await createPost(userId, { title: 'Ancien', content: 'c' });
    const r = await updatePostCore(userId, { id: post.id, title: 'Nouveau' });
    expect(r.status).toBe('success');
    expect((await getPost(userId, post.id))?.title).toBe('Nouveau');
  });

  it('refuse sans aucun champ', async () => {
    const userId = await createTestUser('pu-empty');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const r = await updatePostCore(userId, { id: post.id });
    expect(r.status).toBe('error');
  });

  it("refuse update d'un post d'un autre user", async () => {
    const userA = await createTestUser('pu-cross-a');
    const userB = await createTestUser('pu-cross-b');
    const postA = await createPost(userA, { title: 'T', content: 'c' });
    const r = await updatePostCore(userB, { id: postA.id, content: 'pwned' });
    expect(r.status).toBe('error');
  });
});

describe('deletePostCore', () => {
  it('supprime', async () => {
    const userId = await createTestUser('pd-del');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    await deletePostCore(userId, post.id);
    expect(await getPost(userId, post.id)).toBeUndefined();
  });
});
