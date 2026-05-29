import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { env } from "@/lib/env"
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "./preview"

export type AccountType = "operator" | "audience"

export type Session = {
  user: { id: string; email: string; name: string | null; accountType: AccountType }
}

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// Même chemin en preview qu'en prod : la connexion est réelle (auto-login user3,
// persona audience, géré au niveau de la redirection — cf. loginRedirect).
export async function fetchSession(h: Headers): Promise<Session | null> {
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

function signInRedirectUrl(target?: string, cookieHeader?: string | null): string {
  return loginRedirect({
    authUrl: env.AUTH_URL,
    back: target ?? env.APP_URL,
    preview: isPreview,
    cookieHeader: cookieHeader ?? null,
    defaultUser: DEFAULT_PREVIEW_USER,
  })
}

export async function getSession(): Promise<Session | null> {
  return fetchSession(await headers())
}

export async function requireSession(target?: string): Promise<Session> {
  const h = await headers()
  const s = await fetchSession(h)
  if (!s) redirect(signInRedirectUrl(target, h.get("cookie")))
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

// URL absolue vers le provider, utilisable comme href de lien "Se connecter".
export function signInUrl(target?: string): string {
  return signInRedirectUrl(target)
}

// URL de déconnexion. En preview → preview-logout (efface la session + pose le
// marqueur → chooser). En prod → page du provider.
export function signOutUrl(): string {
  if (isPreview) {
    return `${env.AUTH_URL}/preview-logout?redirect=${encodeURIComponent(env.APP_URL)}`
  }
  return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`
}
