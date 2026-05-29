import { describe, expect, test } from 'vitest';
import { createPost, setPostMedia } from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getLatestPublicationForPost,
  getPublication,
  getPublishedExternalUrlForPost,
  listPublications,
  listPublicationsForCalendar,
  updatePublication,
} from '@/lib/db/repositories/publications';

// No-op : la table user vit côté auth.contentos.ch, plus locale.
async function makeUser(_id: string, _email: string) {}

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

  test('listPublicationsForCalendar joint la miniature image du post', async () => {
    await makeUser('ucal', 'ucal@test.com');
    // Post avec image : le média est stocké directement sur le post (media_url).
    const withImg = await createPost('ucal', {
      title: 'Avec image',
      content: 'c',
    });
    await setPostMedia('ucal', withImg.id, {
      media_id: 'mediacal1',
      media_url: 'https://img/asset.png',
      media_kind: 'image',
      media_width: 100,
      media_height: 100,
    });
    await createPublication('ucal', {
      postId: withImg.id,
      contentSnapshot: 'snap',
      platform: 'linkedin',
    });
    // Post sans image
    const noImg = await createPost('ucal', { title: 'Sans image', content: 'c' });
    await createPublication('ucal', {
      postId: noImg.id,
      contentSnapshot: 'snap2',
      platform: 'linkedin',
    });

    const rows = await listPublicationsForCalendar('ucal');
    const byPost = new Map(rows.map((r) => [r.postId, r]));
    expect(byPost.get(withImg.id)?.thumbnailUrl).toBe('https://img/asset.png');
    expect(byPost.get(noImg.id)?.thumbnailUrl).toBeNull();
  });

  test('getPublishedExternalUrlForPost : null si aucune publication', async () => {
    const postId = await makePostForUser('uxurl');
    expect(await getPublishedExternalUrlForPost('uxurl', postId)).toBeNull();
  });

  test('getPublishedExternalUrlForPost : null si planifié non publié', async () => {
    const postId = await makePostForUser('uxurl');
    await createPublication('uxurl', { postId, contentSnapshot: 's', platform: 'linkedin' });
    expect(await getPublishedExternalUrlForPost('uxurl', postId)).toBeNull();
  });

  test('getPublishedExternalUrlForPost : URL de la dernière publication publiée', async () => {
    const postId = await makePostForUser('uxurl');
    const older = await createPublication('uxurl', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    await updatePublication('uxurl', older.id, {
      status: 'published',
      publishedAt: new Date('2026-01-01'),
      externalUrl: 'https://li/old',
    });
    const newer = await createPublication('uxurl', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    await updatePublication('uxurl', newer.id, {
      status: 'published',
      publishedAt: new Date('2026-02-01'),
      externalUrl: 'https://li/new',
    });
    expect(await getPublishedExternalUrlForPost('uxurl', postId)).toBe('https://li/new');
  });
});
