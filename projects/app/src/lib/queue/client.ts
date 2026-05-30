import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Redis central multi-tenant : on préfixe toutes les clés BullMQ par projet
// (par défaut "cast") pour éviter les collisions entre apps de l'atelier.
// Le worker DOIT utiliser le même préfixe (voir src/worker/index.ts).
const queuePrefix = process.env.QUEUE_PREFIX || 'cast';

export const dummyQueue = new Queue<{ message: string }, { ok: true; echoed: string }>('dummy', {
  connection: redisConnection,
  prefix: queuePrefix,
});

export type PublishLinkedinJob = { publicationId: string; userId: string };
export type PublishLinkedinResult = { externalUrl: string };

export const publishLinkedinQueue = new Queue<PublishLinkedinJob, PublishLinkedinResult>(
  'publish-linkedin',
  {
    connection: redisConnection,
    prefix: queuePrefix,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);
