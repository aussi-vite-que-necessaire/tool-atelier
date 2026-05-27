import type { Job } from 'bullmq';
import { getPublication, updatePublication } from '@/lib/db/repositories/publications';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { LinkedInPublishError, type PublishFn, type PublishMedia } from '@/lib/linkedin/publish';
import { getMediaEngine } from '@/lib/media-engine';
import type { PublishLinkedinJob, PublishLinkedinResult } from '@/lib/queue/client';

const TRANSIENT = new Set(['rate_limit', 'platform_5xx', 'network']);

type Deps = { publish: PublishFn; decrypt: (blob: string) => string };

export function makeProcessPublishLinkedin(deps: Deps) {
  return async function processPublishLinkedin(
    job: Job<PublishLinkedinJob>,
  ): Promise<PublishLinkedinResult> {
    const { publicationId, userId } = job.data;
    const pub = await getPublication(userId, publicationId);
    if (!pub) throw new Error(`publication ${publicationId} introuvable`);
    const account = await getSocialAccount(userId, 'linkedin');
    if (!account) throw new Error('compte LinkedIn introuvable');

    await updatePublication(userId, publicationId, {
      status: 'publishing',
      attempts: pub.attempts + 1,
      lastAttemptAt: new Date(),
    });

    let media: PublishMedia | null = null;
    if (pub.snapshotKeys && pub.snapshotKeys.length > 0) {
      // snapshotKeys[0] est l'assetKey = URL publique engine → download direct
      const bytes = await getMediaEngine().download(pub.snapshotKeys[0]!);
      if (pub.mediaKind === 'carousel') {
        media = { kind: 'document', bytes, filename: 'carrousel.pdf' };
      } else if (pub.mediaKind === 'video') {
        media = { kind: 'video', bytes };
      } else {
        media = { kind: 'image', bytes };
      }
    }

    try {
      const result = await deps.publish({
        content: pub.contentSnapshot,
        media,
        accessToken: deps.decrypt(account.accessToken),
        authorUrn: account.externalId,
      });
      await updatePublication(userId, publicationId, {
        status: 'published',
        publishedAt: new Date(),
        externalPostId: result.id,
        externalUrl: result.url,
        failureKind: null,
        lastError: null,
      });
      return { externalUrl: result.url };
    } catch (err) {
      const kind = err instanceof LinkedInPublishError ? err.kind : 'network';
      await updatePublication(userId, publicationId, {
        status: 'failed',
        failureKind: kind,
        lastError: err instanceof Error ? err.message : String(err),
      });
      if (TRANSIENT.has(kind)) throw err;
      return { externalUrl: '' };
    }
  };
}
