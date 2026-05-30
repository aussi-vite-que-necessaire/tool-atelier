import { auth } from '@/lib/auth';
import { isPreview } from '@/lib/auth/preview';
import { PREVIEW_PASSWORD, PREVIEW_USERS } from '@/lib/auth/preview-users';

export const dynamic = 'force-dynamic';

// Redirection interne uniquement (chemin relatif, même origine que l'app). À
// défaut de cible, on entre dans la suite par la section cast.
function safeRedirect(raw: string | null): string {
  if (!raw) return '/cast';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/cast';
}

// Auto-connexion de preview : ouvre une VRAIE session BetterAuth (email/mot de
// passe connus de l'opérateur de test seedé), puis redirige. Jamais en prod.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = safeRedirect(url.searchParams.get('redirect'));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: '/signin' } });
  }
  const key = url.searchParams.get('user') ?? '1';
  const u = PREVIEW_USERS[key as '1' | '2'];
  if (!u) return new Response(null, { status: 302, headers: { Location: '/signin' } });

  const signed = await auth.api.signInEmail({
    body: { email: u.email, password: PREVIEW_PASSWORD },
    asResponse: true,
  });

  const headers = new Headers({ Location: target });
  for (const cookie of signed.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}
