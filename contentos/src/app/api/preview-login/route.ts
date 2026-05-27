// Auto-login des environnements de preview : connecte un utilisateur de test
// fixe sans email ni saisie. Inerte hors preview (garde isPreview).
import { isPreview, PREVIEW_OTP, PREVIEW_USER } from '@/lib/auth/preview';
import { auth } from '@/lib/auth/server';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Cible interne relative uniquement : le host public est reconstruit par le
  // navigateur (derrière le reverse-proxy, req.url a pour origine le bind
  // interne du conteneur). Garde anti-open-redirect.
  const raw = url.searchParams.get('redirect') || '/';
  const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: '/signin' } });
  }

  // 1. Génère/stocke le code fixe (sendVerificationOTP ne fait rien en preview).
  await auth.api.sendVerificationOTP({
    body: { email: PREVIEW_USER, type: 'sign-in' },
  });

  // 2. Vérifie avec le code fixe → crée user (+ seedUserDefaults) et session.
  const signInRes = await auth.api.signInEmailOTP({
    body: { email: PREVIEW_USER, otp: PREVIEW_OTP },
    asResponse: true,
  });

  // 3. Recopie les cookies de session sur une redirection (relative) vers la cible.
  const res = new Response(null, {
    status: 302,
    headers: { Location: target },
  });
  for (const cookie of signInRes.headers.getSetCookie()) {
    res.headers.append('Set-Cookie', cookie);
  }
  return res;
}
