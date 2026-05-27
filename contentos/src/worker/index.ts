import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { decryptToken } from '@/lib/crypto';
import { env } from '@/lib/env';
import { publish, publishStub } from '@/lib/linkedin/publish';
import { closeRenderer } from '@/lib/visual-templates/render';
import { processDummy } from './queues/dummy';
import { makeProcessGenerateImage } from './queues/generate-image';
import { makeProcessPublishLinkedin } from './queues/publish-linkedin';
import { makeProcessRenderVisual } from './queues/render-visual';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Redis central multi-tenant : même préfixe que les Queue côté enqueue
// (src/lib/queue/client.ts) — sinon le worker ne voit pas les jobs.
const prefix = process.env.QUEUE_PREFIX || 'contentos';

const publishFn = env.CONTENT_OS_LINKEDIN_STUB === '1' ? publishStub : publish;
if (env.CONTENT_OS_LINKEDIN_STUB === '1') {
  console.log('[worker] CONTENT_OS_LINKEDIN_STUB=1 active : LinkedIn NOT called.');
}

const workers = [
  new Worker('dummy', processDummy, { connection, prefix, concurrency: 4 }),
  new Worker('render-visual', makeProcessRenderVisual(), {
    connection,
    prefix,
    concurrency: 2,
  }),
  new Worker('generate-image', makeProcessGenerateImage(), { connection, prefix, concurrency: 2 }),
  new Worker(
    'publish-linkedin',
    makeProcessPublishLinkedin({
      publish: publishFn,
      decrypt: decryptToken,
    }),
    { connection, prefix, concurrency: 2 },
  ),
];

console.log(`[worker] ${workers.length} consumer(s) ready`);

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received, closing...`);
  await Promise.all(workers.map((w) => w.close()));
  await closeRenderer();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
