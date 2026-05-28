import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isPreview } from '@/lib/auth/preview';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (isPreview) return NextResponse.next();
  const cookie = request.headers.get('cookie') ?? '';
  // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch).
  const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
  if (!hasSession) {
    // L'URL interne du conteneur derrière le proxy lab fuiterait dans request.url ;
    // on reconstruit depuis APP_URL (origine publique) + pathname + search.
    const url = new URL(request.url);
    const back = `${env.APP_URL}${url.pathname}${url.search}`;
    const dest = `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(back)}`;
    return NextResponse.redirect(dest);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!healthz|signin|oauth|\\.well-known|api/auth|api/mcp|api/preview-login|api/__test__|_next|favicon).*)',
  ],
};
