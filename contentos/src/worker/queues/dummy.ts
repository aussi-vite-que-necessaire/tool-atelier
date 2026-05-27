import type { Job } from 'bullmq';

export async function processDummy(
  job: Job<{ message: string }>,
): Promise<{ ok: true; echoed: string }> {
  console.log(`[dummy] processing job ${job.id} : ${job.data.message}`);
  return { ok: true, echoed: job.data.message };
}
