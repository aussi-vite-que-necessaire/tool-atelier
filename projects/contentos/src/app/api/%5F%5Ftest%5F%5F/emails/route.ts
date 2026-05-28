import { getEmailSender } from '@/lib/email/send';

export async function GET(req: Request): Promise<Response> {
  if (process.env.E2E_TESTING !== 'true') {
    return new Response('Not found', { status: 404 });
  }
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  const sender = getEmailSender();
  const inbox = sender.inbox?.(to) ?? [];
  return Response.json({ emails: inbox });
}

export async function DELETE(): Promise<Response> {
  if (process.env.E2E_TESTING !== 'true') {
    return new Response('Not found', { status: 404 });
  }
  getEmailSender().clear?.();
  return new Response(null, { status: 204 });
}
