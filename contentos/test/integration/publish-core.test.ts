import { describe, expect, test, vi } from 'vitest';
import { createPost } from '@/lib/db/repositories/posts';
import { getPublication, updatePublication } from '@/lib/db/repositories/publications';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import {
  cancelPublication,
  publishNow,
  removePublication,
  schedulePublication,
} from '@/lib/publications/publish-core';
import { createTestUser } from './helpers/seed';

async function setup(label: string) {
  const userId = await createTestUser(label);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: 'urn:li:person:X',
    displayName: 'X',
    accessToken: 'enc',
    expiresAt: new Date(Date.now() + 1e9),
    scopes: 'w_member_social',
  });
  const post = await createPost(userId, { title: 'T', content: 'mon contenu' });
  return { userId, postId: post.id };
}

describe('publish-core', () => {
  test('publishNow fige le snapshot et enqueue (queued)', async () => {
    const { userId, postId } = await setup('pn');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const pub = await publishNow(userId, postId, enqueue);
    expect(pub.status).toBe('queued');
    expect(pub.contentSnapshot).toBe('mon contenu');
    expect(enqueue).toHaveBeenCalledWith(pub.id, undefined);
  });

  test('schedule fige le snapshot avec scheduledFor (scheduled) + delay', async () => {
    const { userId, postId } = await setup('sc');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const when = new Date(Date.now() + 3_600_000);
    const pub = await schedulePublication(userId, postId, when, 'Europe/Paris', enqueue);
    expect(pub.status).toBe('scheduled');
    expect(pub.scheduledFor?.getTime()).toBe(when.getTime());
    expect(enqueue).toHaveBeenCalled();
  });

  test('publishNow échoue si pas de compte LinkedIn', async () => {
    const userId = await createTestUser('nolink');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    await expect(publishNow(userId, post.id, vi.fn())).rejects.toThrow(/LinkedIn/);
  });

  test('cancel supprime une publication scheduled et dequeue', async () => {
    const { userId, postId } = await setup('cx');
    const dequeue = vi.fn().mockResolvedValue(undefined);
    const pub = await schedulePublication(
      userId,
      postId,
      new Date(Date.now() + 1e6),
      'UTC',
      vi.fn(),
    );
    await cancelPublication(userId, pub.id, dequeue);
    expect(await getPublication(userId, pub.id)).toBeUndefined();
    expect(dequeue).toHaveBeenCalledWith(pub.id);
  });

  test('remove supprime une publication publiée (que cancel refuse) et dequeue', async () => {
    const { userId, postId } = await setup('rm');
    const dequeue = vi.fn().mockResolvedValue(undefined);
    const pub = await schedulePublication(
      userId,
      postId,
      new Date(Date.now() + 1e6),
      'UTC',
      vi.fn(),
    );
    await updatePublication(userId, pub.id, { status: 'published' });
    // cancel refuse une publication terminée…
    await expect(cancelPublication(userId, pub.id, vi.fn())).rejects.toThrow(/non annulable/);
    // …mais remove la supprime quand même.
    await removePublication(userId, pub.id, dequeue);
    expect(await getPublication(userId, pub.id)).toBeUndefined();
    expect(dequeue).toHaveBeenCalledWith(pub.id);
  });

  test('remove refuse une publication en cours', async () => {
    const { userId, postId } = await setup('rmpub');
    const pub = await schedulePublication(
      userId,
      postId,
      new Date(Date.now() + 1e6),
      'UTC',
      vi.fn(),
    );
    await updatePublication(userId, pub.id, { status: 'publishing' });
    await expect(removePublication(userId, pub.id, vi.fn())).rejects.toThrow(/en cours/);
    expect(await getPublication(userId, pub.id)).toBeDefined();
  });

  test('remove échoue si la publication est introuvable', async () => {
    const userId = await createTestUser('rmmissing');
    await expect(removePublication(userId, 'nope', vi.fn())).rejects.toThrow(/introuvable/);
  });
});
