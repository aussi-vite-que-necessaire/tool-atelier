import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview"

// ressources = outil d'administration. Seules les zones /admin (et l'entrée nommée
// /connexion) passent par le SSO. Le public (espaces /o/*, reader, bibliothèque,
// compte) et son cookie de tracking vivent désormais dans le projet `docs`.
const SSO_GATED = /^\/admin(?:\/|$)/

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Gate SSO sur la zone admin (preview comme prod : connexion réelle ; en preview,
  // l'absence de cookie déclenche l'auto-login user1 via loginRedirect).
  if (SSO_GATED.test(pathname)) {
    const cookie = req.headers.get("cookie") ?? ""
    // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch / .preview…).
    const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie)
    if (!hasSession) {
      // L'URL interne du conteneur derrière le proxy lab fuiterait dans request.url ;
      // on reconstruit depuis APP_URL (origine publique) + pathname + search.
      const url = new URL(req.url)
      const back = `${env.APP_URL}${url.pathname}${url.search}`
      const dest = loginRedirect({
        authUrl: env.AUTH_URL,
        back,
        preview: isPreview,
        cookieHeader: cookie,
        defaultUser: DEFAULT_PREVIEW_USER,
      })
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/connexion"],
}
