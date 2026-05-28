import { NextResponse, type NextRequest } from "next/server"
import { parseRefFromParams, serializeRefCookie, REF_COOKIE, REF_MAX_AGE } from "@/lib/tracking/ref"

export function proxy(req: NextRequest) {
  const res = NextResponse.next()
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

export const config = { matcher: ["/r/:path*"] }
