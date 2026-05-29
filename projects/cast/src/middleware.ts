import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isPreview, loginRedirect, hasSessionCookie, DEFAULT_PREVIEW_USER } from '@/lib/auth/preview';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const cookie = request.headers.get('cookie') ?? '';
  // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch / .preview…).
  if (!hasSessionCookie(cookie)) {
    // L'URL interne du conteneur derrière le proxy lab fuiterait dans request.url ;
    // on reconstruit depuis APP_URL (origine publique) + pathname + search.
    const url = new URL(request.url);
    const back = `${env.APP_URL}${url.pathname}${url.search}`;
    // En preview, l'absence de cookie déclenche l'auto-login user1 via loginRedirect.
    const dest = loginRedirect({
      authUrl: env.AUTH_URL,
      back,
      preview: isPreview,
      cookieHeader: cookie,
      defaultUser: DEFAULT_PREVIEW_USER,
    });
    return NextResponse.redirect(dest);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!healthz|signin|oauth|\\.well-known|api/auth|api/mcp|api/preview-login|api/__test__|_next|favicon).*)',
  ],
};
