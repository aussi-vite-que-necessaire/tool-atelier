import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { env } from "@/lib/env"
import { isPreview, PREVIEW_USER_ID, PREVIEW_USER_EMAIL } from "./preview"

export type AccountType = "operator" | "audience"

export type Session = {
  user: { id: string; email: string; name: string | null; accountType: AccountType }
}

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// En preview, court-circuite avec PREVIEW_USER_ID (operator, pour garder l'accès
// admin auto comme avant).
export async function fetchSession(h: Headers): Promise<Session | null> {
  if (isPreview) {
    return {
      user: { id: PREVIEW_USER_ID, email: PREVIEW_USER_EMAIL, name: "Preview", accountType: "operator" },
    }
  }
  const cookie = h.get("cookie")
  if (!cookie) return null
  const res = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.user?.id) return null
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      name: data.user.name ?? null,
      accountType: data.user.accountType === "operator" ? "operator" : "audience",
    },
  }
}

function signInRedirectUrl(target?: string): string {
  const redirectTo = target ?? env.APP_URL
  return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(redirectTo)}`
}

export async function getSession(): Promise<Session | null> {
  return fetchSession(await headers())
}

export async function requireSession(target?: string): Promise<Session> {
  const s = await getSession()
  if (!s) redirect(signInRedirectUrl(target))
  return s
}

export async function getUserId(): Promise<string | undefined> {
  const s = await getSession()
  return s?.user.id
}

export async function requireUserId(target?: string): Promise<string> {
  const s = await requireSession(target)
  return s.user.id
}

// URL absolue vers /sign-in de auth.contentos.ch, utilisable comme href de lien
// "Se connecter" / "Se déconnecter" (auth gère le sign-out côté provider).
export function signInUrl(target?: string): string {
  return signInRedirectUrl(target)
}
