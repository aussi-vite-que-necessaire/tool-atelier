// Auto-login des environnements de preview : connecte un utilisateur de test
// fixe sans email ni saisie. Inerte hors preview (garde isPreview).
import { isPreview, PREVIEW_OTP, PREVIEW_USER } from '@/lib/auth/preview';
import { auth } from '@/lib/auth/server';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = url.searchParams.get('redirect') || '/';

  if (!isPreview) {
    return Response.redirect(new URL('/signin', url.origin), 302);
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

  // 3. Recopie les cookies de session sur une redirection vers la cible.
  const res = new Response(null, {
    status: 302,
    headers: { Location: new URL(target, url.origin).toString() },
  });
  for (const cookie of signInRes.headers.getSetCookie()) {
    res.headers.append('Set-Cookie', cookie);
  }
  return res;
}
