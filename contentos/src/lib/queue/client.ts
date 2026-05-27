import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Redis central multi-tenant : on préfixe toutes les clés BullMQ par projet
// (par défaut "contentos") pour éviter les collisions entre apps de l'atelier.
// Le worker DOIT utiliser le même préfixe (voir src/worker/index.ts).
const queuePrefix = process.env.QUEUE_PREFIX || 'contentos';

export const dummyQueue = new Queue<{ message: string }, { ok: true; echoed: string }>('dummy', {
  connection: redisConnection,
  prefix: queuePrefix,
});

export type RenderVisualJob = {
  userId: string;
  templateId: string;
  vars: Record<string, unknown>;
  mode: 'preview' | 'final';
  // En mode final : 'post' attache au post (postId requis), 'gallery' crée une
  // image standalone réutilisable (ex. slide de carrousel). Défaut : 'post'.
  destination?: 'post' | 'gallery';
  postId?: string;
  jobKey: string;
};

export type RenderVisualResult =
  | { mode: 'preview'; previewKey: string; url: string; width: number; height: number }
  | { mode: 'final'; mediaId: string; url: string; width: number; height: number };

export const renderVisualQueue = new Queue<RenderVisualJob, RenderVisualResult>('render-visual', {
  connection: redisConnection,
  prefix: queuePrefix,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export type GenerateImageJob = {
  userId: string;
  prompt: string;
  aspectRatio?: string;
  styleId?: string;
  sourceMediaId?: string;
  postId?: string;
  jobKey: string;
};

export type GenerateImageResult = {
  mediaId: string;
  url: string;
  width: number;
  height: number;
};

export const generateImageQueue = new Queue<GenerateImageJob, GenerateImageResult>(
  'generate-image',
  {
    connection: redisConnection,
    prefix: queuePrefix,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);

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
