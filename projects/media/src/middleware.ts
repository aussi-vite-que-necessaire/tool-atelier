import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isPreview, loginRedirect, hasSessionCookie, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview";

// Bloque l'accès aux pages protégées sans cookie de session, sans toucher la DB
// ni le SSO : simple présence du cookie cross-subdomain `.contentos.ch`.
// L'auth réelle est revalidée par `requireUserId()` côté Server Component / API.
// En preview, l'absence de cookie déclenche l'auto-login user1 via loginRedirect.
export function middleware(request: NextRequest): NextResponse {
  const cookie = request.headers.get("cookie") ?? "";
  // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch / .preview…).
  if (!hasSessionCookie(cookie)) {
    // L'URL interne du conteneur derrière le proxy lab fuiterait dans request.url ;
    // on reconstruit depuis APP_URL (origine publique) + pathname + search.
    const url = new URL(request.url);
    const back = `${env.APP_URL}${url.pathname}${url.search}`;
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
    // Laisse passer : healthz, sign-in, les endpoints internes service-key
    // (/internal, /v1), assets Next, favicon.
    "/((?!healthz|sign-in|internal|v1|_next|favicon).*)",
  ],
};
