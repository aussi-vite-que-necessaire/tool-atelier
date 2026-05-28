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
    // Exclus de la garde de session : healthz (sonde lab), signin, l'auto-login
    // preview (doit être joignable sans session), les routes auth/MCP/OAuth et test.
    '/((?!healthz|signin|oauth|\\.well-known|api/auth|api/mcp|api/preview-login|api/__test__|_next|favicon).*)',
  ],
};
