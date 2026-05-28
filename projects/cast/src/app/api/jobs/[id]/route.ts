import { queueRegistry } from '@/lib/queue/registry';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const url = new URL(req.url);
  const queueName = url.searchParams.get('queue') ?? 'dummy';
  const queue = queueRegistry[queueName];
  if (!queue) {
    return Response.json({ error: `Unknown queue: ${queueName}` }, { status: 400 });
  }
  const job = await queue.getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const state = await job.getState();
  return Response.json({
    id: job.id,
    queue: queueName,
    status: state,
    progress: job.progress,
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
  });
}
