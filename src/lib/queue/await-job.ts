import { QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';
import { queueRegistry } from './registry';

export async function awaitJobResult<T>(
  queueName: string,
  jobId: string,
  timeoutMs = 60_000,
): Promise<T> {
  const queue = queueRegistry[queueName];
  if (!queue) throw new Error(`queue ${queueName} inconnue`);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`job ${jobId} introuvable`);
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  // Même préfixe que les Queue/Worker (Redis central multi-tenant).
  const events = new QueueEvents(queueName, {
    connection,
    prefix: process.env.QUEUE_PREFIX || 'cast',
  });
  try {
    await events.waitUntilReady();
    return (await job.waitUntilFinished(events, timeoutMs)) as T;
  } finally {
    await events.close();
    await connection.quit();
  }
}
