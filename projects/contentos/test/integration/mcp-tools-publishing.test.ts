import { describe, expect, test, vi } from 'vitest';
import { createPost } from '@/lib/db/repositories/posts';
import { getPublication, updatePublication } from '@/lib/db/repositories/publications';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import {
  cancelScheduledTool,
  deletePublicationTool,
  getLinkedinConnectionTool,
  publishNowTool,
  schedulePostTool,
} from '@/lib/mcp/tools/publishing';
import { createTestUser } from './helpers/seed';

async function withLinkedIn(label: string) {
  const userId = await createTestUser(label);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: 'urn:li:person:X',
    displayName: 'Compte X',
    accessToken: 'enc',
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    scopes: 'w_member_social',
  });
  const post = await createPost(userId, { title: 'T', content: 'à publier' });
  return { userId, postId: post.id };
}

describe('mcp tools — publication', () => {
  test('get_linkedin_connection : connecté / non connecté', async () => {
    const notConnected = await createTestUser('mcpnolink');
    expect(await getLinkedinConnectionTool(notConnected)).toEqual({ connected: false });

    const { userId } = await withLinkedIn('mcplink');
    const conn = await getLinkedinConnectionTool(userId);
    expect(conn.connected).toBe(true);
    expect(conn.runwayDays).toBeGreaterThan(0);
  });

  test('publish_post_now : enqueue + attente injectés → renvoie published', async () => {
    const { userId, postId } = await withLinkedIn('mcppub');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    // Simule le worker : marque la publication published pendant l'attente.
    const awaitDone = vi.fn(async (id: string) => {
      await updatePublication(userId, id, { status: 'published', externalUrl: 'https://li/1' });
    });
    const r = await publishNowTool(userId, { postId }, { enqueue, awaitDone });
    expect(r.status).toBe('published');
    expect(r.externalUrl).toBe('https://li/1');
    expect(enqueue).toHaveBeenCalledOnce();
  });

  test('schedule_post : enqueue AVEC un délai jusqu’à whenIso (pas immédiat)', async () => {
    const { userId, postId } = await withLinkedIn('mcpscheddelay');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const whenIso = new Date(Date.now() + 3_600_000).toISOString();
    const pub = await schedulePostTool(userId, { postId, whenIso }, enqueue);
    expect(pub.status).toBe('scheduled');
    // Le job doit partir AVEC un délai (~1h), sinon le worker publie tout de suite.
    expect(enqueue).toHaveBeenCalledOnce();
    const delayMs = enqueue.mock.calls[0]?.[1];
    expect(delayMs).toBeGreaterThan(3_000_000);
    expect(delayMs).toBeLessThanOrEqual(3_600_000);
  });

  test('schedule_post puis cancel_scheduled', async () => {
    const { userId, postId } = await withLinkedIn('mcpsched');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const pub = await schedulePostTool(
      userId,
      { postId, whenIso: new Date(Date.now() + 3_600_000).toISOString() },
      enqueue,
    );
    expect(pub.status).toBe('scheduled');

    const dequeue = vi.fn().mockResolvedValue(undefined);
    await cancelScheduledTool(userId, { publicationId: pub.id }, dequeue);
    expect(await getPublication(userId, pub.id)).toBeUndefined();
    expect(dequeue).toHaveBeenCalledOnce();
  });

  test('delete_publication : supprime une publication publiée + dequeue', async () => {
    const { userId, postId } = await withLinkedIn('mcpdel');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const pub = await schedulePostTool(
      userId,
      { postId, whenIso: new Date(Date.now() + 3_600_000).toISOString() },
      enqueue,
    );
    await updatePublication(userId, pub.id, { status: 'published' });

    const dequeue = vi.fn().mockResolvedValue(undefined);
    const r = await deletePublicationTool(userId, { publicationId: pub.id }, dequeue);
    expect(r).toEqual({ deleted: pub.id });
    expect(await getPublication(userId, pub.id)).toBeUndefined();
    expect(dequeue).toHaveBeenCalledOnce();
  });
});
