import type { Job } from 'bullmq';
import { describe, expect, test, vi } from 'vitest';
import { createPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  getPublication,
  updatePublication,
} from '@/lib/db/repositories/publications';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import { LinkedInPublishError } from '@/lib/linkedin/publish';
import { getMediaEngine } from '@/lib/media-engine';
import type { PublishLinkedinJob } from '@/lib/queue/client';
import { makeProcessPublishLinkedin } from '@/worker/queues/publish-linkedin';
import { createTestUser } from '../integration/helpers/seed';

async function makePub(label: string, content = 'hello') {
  const userId = await createTestUser(label);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: 'urn:li:person:X',
    displayName: 'X',
    accessToken: 'plain-token',
    expiresAt: new Date(Date.now() + 1e9),
    scopes: 'w_member_social',
  });
  const post = await createPost(userId, { title: 'T', content });
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: content,
    platform: 'linkedin',
    status: 'queued',
  });
  return { userId, pubId: pub.id };
}

function job(publicationId: string, userId: string): Job<PublishLinkedinJob> {
  return { data: { publicationId, userId } } as Job<PublishLinkedinJob>;
}

const decrypt = (t: string) => t;

describe('processPublishLinkedin', () => {
  test('succès → published + externalUrl', async () => {
    const { userId, pubId } = await makePub('pub-ok');
    const publish = vi.fn().mockResolvedValue({ id: 'urn:li:share:1', url: 'https://x/1' });
    const process = makeProcessPublishLinkedin({ publish, decrypt });
    await process(job(pubId, userId));
    const pub = await getPublication(userId, pubId);
    expect(pub?.status).toBe('published');
    expect(pub?.externalUrl).toBe('https://x/1');
  });

  test('carrousel → publish reçoit un média document ; vidéo → video', async () => {
    // Upload un objet dans l'engine pour avoir une URL valide comme snapshotKey.
    const engineObj = await getMediaEngine().upload({
      bytes: Buffer.from('BYTES'),
      contentType: 'application/pdf',
    });

    for (const [kind, expected] of [
      ['carousel', 'document'],
      ['video', 'video'],
      ['image', 'image'],
    ] as const) {
      const { userId, pubId } = await makePub(`pub-${kind}`);
      // snapshotKeys[0] = URL engine (memory://...) pointant vers un objet réel du stub
      await updatePublication(userId, pubId, {
        mediaKind: kind,
        snapshotKeys: [engineObj.url],
      });
      const publish = vi.fn().mockResolvedValue({ id: 'urn:li:share:1', url: 'https://x/1' });
      const process = makeProcessPublishLinkedin({ publish, decrypt });
      await process(job(pubId, userId));
      const arg = publish.mock.calls[0]![0] as { media: { kind: string } | null };
      expect(arg.media?.kind).toBe(expected);
    }
  });

  test('erreur permanente (token_expired) → failed, ne relève pas', async () => {
    const { userId, pubId } = await makePub('pub-perm');
    const publish = vi.fn().mockRejectedValue(new LinkedInPublishError('401', 'token_expired'));
    const process = makeProcessPublishLinkedin({ publish, decrypt });
    await expect(process(job(pubId, userId))).resolves.toBeDefined();
    const pub = await getPublication(userId, pubId);
    expect(pub?.status).toBe('failed');
    expect(pub?.failureKind).toBe('token_expired');
  });

  test('erreur transitoire (platform_5xx) → failed + relève (retry BullMQ)', async () => {
    const { userId, pubId } = await makePub('pub-trans');
    const publish = vi.fn().mockRejectedValue(new LinkedInPublishError('503', 'platform_5xx'));
    const process = makeProcessPublishLinkedin({ publish, decrypt });
    await expect(process(job(pubId, userId))).rejects.toThrow();
    const pub = await getPublication(userId, pubId);
    expect(pub?.failureKind).toBe('platform_5xx');
  });
});
