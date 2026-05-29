import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"
import { isPreview } from "@/lib/auth/preview"

// ressources = outil d'administration. Seules les zones /admin (et l'entrée nommée
// /connexion) passent par le SSO. Le public (espaces /o/*, reader, bibliothèque,
// compte) et son cookie de tracking vivent désormais dans le projet `docs`.
const SSO_GATED = /^\/admin(?:\/|$)/

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Court-circuit preview : pas de SSO, auto-login local (opérateur démo).
  if (isPreview) return NextResponse.next()

  // Gate SSO sur la zone admin.
  if (SSO_GATED.test(pathname)) {
    const cookie = req.headers.get("cookie") ?? ""
    // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch).
    const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie)
    if (!hasSession) {
      // L'URL interne du conteneur derrière le proxy lab fuiterait dans request.url ;
      // on reconstruit depuis APP_URL (origine publique) + pathname + search.
      const url = new URL(req.url)
      const back = `${env.APP_URL}${url.pathname}${url.search}`
      const dest = `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(back)}`
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/connexion"],
}
