import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/lib/env"
import { isPreview, loginRedirect, hasSessionCookie, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview"
import {
  parseRefFromParams,
  serializeRefCookie,
  REF_COOKIE,
  REF_MAX_AGE,
} from "@/lib/tracking/ref"

// Routes gardées par le SSO (en plus du gating fin côté pages). Le reader public
// /o/.../r/* reste accessible sans cookie : l'authentification est demandée *dans*
// le reader si la ressource n'est pas accessible anonymement (ResourceGate).
// docs est l'app publique (consommation) : pas d'/admin ici — l'admin vit dans `ressources`.
const SSO_GATED = /^\/(compte|bibliotheque)(?:\/|$)/

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

  // Gate SSO sur les zones authentifiées (preview comme prod : connexion réelle ;
  // en preview, l'absence de cookie déclenche l'auto-login user3 via loginRedirect).
  if (SSO_GATED.test(pathname)) {
    const cookie = req.headers.get("cookie") ?? ""
    // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch / .preview…).
    if (!hasSessionCookie(cookie)) {
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
  // Matcher = union de ce qui peut nous concerner : tracking sur /o/* (espaces
  // opérateur), SSO sur /compte, /bibliotheque, /connexion. Exclut healthz, _next,
  // api, .well-known (publics). Les liens legacy /r/* sont gérés par une page de
  // redirection (pas besoin de middleware).
  matcher: ["/o/:path*", "/compte/:path*", "/bibliotheque/:path*", "/connexion"],
}
