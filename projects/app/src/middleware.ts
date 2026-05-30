import { type NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_PREVIEW_USER,
  hasSessionCookie,
  isPreview,
  loginRedirect,
} from '@/lib/auth/preview';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const cookie = request.headers.get('cookie') ?? '';
  // Cookie de session BetterAuth (auth in-app, une seule origine).
  if (!hasSessionCookie(cookie)) {
    // Destination relative à l'origine courante (auth in-app) : pas d'URL externe.
    // back = chemin demandé (relatif) pour revenir après connexion.
    const back = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    // En preview, l'absence de cookie déclenche l'auto-login local via loginRedirect.
    const dest = loginRedirect({
      back,
      preview: isPreview,
      cookieHeader: cookie,
      defaultUser: DEFAULT_PREVIEW_USER,
    });
    return NextResponse.redirect(new URL(dest, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Zone protégée = tout sauf routes système/auth et vitrines publiques (landing
    // à la racine, styleguide, espace public docs). `$` exempte la racine exacte
    // sans toucher /cast. `docs` reste public (lecture des lead magnets publiés).
    '/((?!$|styleguide|docs|healthz|signin|signup|preview-login|preview-logout|oauth|api/auth|internal|api/preview-login|api/__test__|_next|favicon).*)',
  ],
};
