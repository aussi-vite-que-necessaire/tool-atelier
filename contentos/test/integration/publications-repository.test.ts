import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getLatestPublicationForPost,
  getPublication,
  listPublications,
  updatePublication,
} from '@/lib/db/repositories/publications';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

async function makePostForUser(userId: string): Promise<string> {
  const post = await createPost(userId, { title: 'T', content: 'final' });
  return post.id;
}

describe('publications repository', () => {
  test('createPublication insère avec defaults', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const pub = await createPublication('u1', {
      postId,
      contentSnapshot: 'snapshot content',
      platform: 'linkedin',
    });
    expect(pub.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(pub.userId).toBe('u1');
    expect(pub.postId).toBe(postId);
    expect(pub.contentSnapshot).toBe('snapshot content');
    expect(pub.platform).toBe('linkedin');
    expect(pub.status).toBe('scheduled');
    expect(pub.attempts).toBe(0);
  });

  test('getPublication retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    const found = await getPublication('u1', created.id);
    expect(found?.contentSnapshot).toBe('s');
  });

  test('listPublications retourne toutes les publications du user', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    await createPublication('u1', { postId, contentSnapshot: 'a', platform: 'linkedin' });
    await createPublication('u1', { postId, contentSnapshot: 'b', platform: 'linkedin' });
    const rows = await listPublications('u1');
    expect(rows).toHaveLength(2);
  });

  test('updatePublication modifie le cycle de vie', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePublication('u1', created.id, {
      status: 'queued',
      attempts: 1,
      lastError: 'noop',
    });
    expect(updated?.status).toBe('queued');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('noop');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePublication supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    await deletePublication('u1', created.id);
    expect(await getPublication('u1', created.id)).toBeUndefined();
  });

  test('getLatestPublicationForPost renvoie la plus récente, ou undefined', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    expect(await getLatestPublicationForPost('u1', postId)).toBeUndefined();
    await createPublication('u1', {
      postId,
      contentSnapshot: 'a',
      platform: 'linkedin',
      status: 'queued',
    });
    const latest = await getLatestPublicationForPost('u1', postId);
    expect(latest?.status).toBe('queued');
  });
});
