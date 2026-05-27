import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    const url = new URL('/signin', request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // healthz : sonde de liveness lab, doit rester accessible sans session.
    '/((?!healthz|signin|verify|oauth|\\.well-known|api/auth|api/mcp|api/__test__|_next|favicon).*)',
  ],
};
