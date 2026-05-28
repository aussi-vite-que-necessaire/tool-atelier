import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isPreview } from "@/lib/auth/preview";

// Bloque l'accès aux pages protégées sans cookie de session, sans toucher la DB
// ni le SSO : simple présence du cookie cross-subdomain `.contentos.ch`.
// L'auth réelle est revalidée par `requireUserId()` côté Server Component / API.
export function middleware(request: NextRequest): NextResponse {
  if (isPreview) return NextResponse.next();
  const cookie = request.headers.get("cookie") ?? "";
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
    // Laisse passer : healthz, sign-in, l'API MCP (auth Bearer), /v1 (auth service-key),
    // .well-known (découverte OAuth), assets Next, favicon.
    "/((?!healthz|sign-in|api/mcp|v1|\\.well-known|_next|favicon).*)",
  ],
};
