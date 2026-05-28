import { dummyQueue, type PublishLinkedinJob, publishLinkedinQueue } from './client';

export async function enqueueDummy(message: string): Promise<string> {
  const job = await dummyQueue.add('echo', { message });
  return job.id!;
}

export async function enqueuePublishLinkedin(
  payload: PublishLinkedinJob,
  delayMs?: number,
): Promise<string> {
  const job = await publishLinkedinQueue.add('publish', payload, {
    jobId: payload.publicationId,
    delay: delayMs && delayMs > 0 ? delayMs : undefined,
  });
  return job.id!;
}

export async function removePublishLinkedin(publicationId: string): Promise<void> {
  const job = await publishLinkedinQueue.getJob(publicationId);
  if (job) await job.remove();
}
