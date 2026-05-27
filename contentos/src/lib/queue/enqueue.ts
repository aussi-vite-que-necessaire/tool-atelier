import {
  dummyQueue,
  type GenerateImageJob,
  generateImageQueue,
  type PublishLinkedinJob,
  publishLinkedinQueue,
  type RenderVisualJob,
  renderVisualQueue,
} from './client';

export async function enqueueDummy(message: string): Promise<string> {
  const job = await dummyQueue.add('echo', { message });
  return job.id!;
}

export async function enqueueRenderVisual(payload: RenderVisualJob): Promise<string> {
  const job = await renderVisualQueue.add('render', payload, { jobId: payload.jobKey });
  return job.id!;
}

export async function enqueueGenerateImage(payload: GenerateImageJob): Promise<string> {
  const job = await generateImageQueue.add('generate', payload, { jobId: payload.jobKey });
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
