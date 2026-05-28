import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { isPreview } from '@/lib/auth/preview';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (isPreview) return NextResponse.next();
  const cookie = request.headers.get('cookie') ?? '';
  // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch).
  const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
  if (!hasSession) {
    const dest = `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(request.url)}`;
    return NextResponse.redirect(dest);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!healthz|signin|oauth|\\.well-known|api/auth|api/mcp|api/preview-login|api/__test__|_next|favicon).*)',
  ],
};
