import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"
import { isPreview } from "@/lib/auth/preview"
import {
  parseRefFromParams,
  serializeRefCookie,
  REF_COOKIE,
  REF_MAX_AGE,
} from "@/lib/tracking/ref"

// Routes gardées par le SSO (en plus du gating fin côté pages). Le reader public
// /r/* reste accessible sans cookie : l'authentification est demandée *dans* le
// reader si la ressource n'est pas accessible anonymement (ResourceGate).
const SSO_GATED = /^\/(admin|compte|bibliotheque)(?:\/|$)/

function setRefCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.has(REF_COOKIE)) return res // first-touch : ne pas écraser
  const ref = parseRefFromParams(req.nextUrl.searchParams)
  if (!ref) return res
  res.cookies.set(REF_COOKIE, serializeRefCookie(ref), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REF_MAX_AGE,
  })
  return res
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // Pose le cookie de tracking sur les espaces opérateur publics (/o/...).
  if (pathname.startsWith("/o/")) {
    return setRefCookie(req, NextResponse.next())
  }

  // Court-circuit preview : pas de SSO, auto-login local.
  if (isPreview) return NextResponse.next()

  // Gate SSO sur les zones authentifiées.
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
  // Matcher = union de ce qui peut nous concerner : tracking sur /o/* (espaces
  // opérateur), SSO sur /admin, /compte, /bibliotheque, /connexion. Exclut
  // healthz, _next, api, .well-known (gérés ailleurs / publics). Les liens
  // legacy /r/* sont gérés par une page de redirection (pas besoin de middleware).
  matcher: ["/o/:path*", "/admin/:path*", "/compte/:path*", "/bibliotheque/:path*", "/connexion"],
}
