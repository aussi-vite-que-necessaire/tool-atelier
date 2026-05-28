import { isPreview } from '@/lib/auth/preview';

// En preview, `session.ts` court-circuite avec PREVIEW_USER_ID sans cookie ;
// ce handler reste juste pour préserver les liens existants vers /api/preview-login.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = url.searchParams.get('redirect') || '/';
  const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: '/signin' } });
  }
  return new Response(null, { status: 302, headers: { Location: target } });
}
