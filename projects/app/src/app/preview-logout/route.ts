import { auth } from '@/lib/auth';
import { isPreview } from '@/lib/auth/preview';

export const dynamic = 'force-dynamic';

function safeRedirect(raw: string | null): string {
  if (!raw) return '/';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

// Déconnexion de preview : efface la session ET pose le marqueur
// `cos_preview_login=manual` (tant qu'il est là, le middleware/signin montrent
// le chooser au lieu d'auto-connecter). Puis renvoie vers /signin. Jamais en prod.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const back = safeRedirect(url.searchParams.get('redirect'));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: '/signin' } });
  }
  const cleared = await auth.api.signOut({ headers: req.headers, asResponse: true });
  const location = `/signin?redirect=${encodeURIComponent(back)}`;
  const headers = new Headers({ Location: location });
  for (const cookie of cleared.headers.getSetCookie()) headers.append('set-cookie', cookie);
  headers.append(
    'set-cookie',
    'cos_preview_login=manual; Path=/; Max-Age=31536000; Secure; SameSite=Lax',
  );
  return new Response(null, { status: 302, headers });
}
