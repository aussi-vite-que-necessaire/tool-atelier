import { QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { enqueueDummy } from '@/lib/queue/enqueue';
import { processDummy } from '@/worker/queues/dummy';

let worker: Worker;
let connection: IORedis;
let queueEvents: QueueEvents;

beforeAll(async () => {
  // Même préfixe que l'app (src/lib/queue/client.ts + src/worker/index.ts) : sans ça,
  // l'enqueue (préfixe "cast") et le Worker/QueueEvents (préfixe BullMQ "bull")
  // visent des namespaces Redis distincts et le round-trip ne se boucle jamais.
  const prefix = process.env.QUEUE_PREFIX || 'cast';
  connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  worker = new Worker('dummy', processDummy, { connection, prefix, concurrency: 1 });
  queueEvents = new QueueEvents('dummy', { connection: { url: process.env.REDIS_URL }, prefix });
  await queueEvents.waitUntilReady();
});

afterAll(async () => {
  await worker.close();
  await queueEvents.close();
  await connection.quit();
});

describe('dummy queue round-trip', () => {
  test('enqueue + process retourne le résultat attendu', async () => {
    const jobId = await enqueueDummy('hello world');
    const result = await new Promise<{ ok: true; echoed: string }>((resolve, reject) => {
      queueEvents.on('completed', ({ jobId: id, returnvalue }) => {
        if (id !== jobId) return;
        // BullMQ v5+ deserialise returnvalue avant de l'émettre. On garde un
        // fallback parse pour rester compatible avec d'éventuelles versions
        // antérieures qui émettent encore une string JSON.
        const parsed =
          typeof returnvalue === 'string'
            ? JSON.parse(returnvalue)
            : (returnvalue as { ok: true; echoed: string });
        resolve(parsed);
      });
      queueEvents.on('failed', ({ jobId: id, failedReason }) => {
        if (id === jobId) reject(new Error(failedReason));
      });
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect(result).toEqual({ ok: true, echoed: 'hello world' });
  });
});
