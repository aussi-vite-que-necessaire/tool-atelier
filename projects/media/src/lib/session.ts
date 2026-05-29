import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview";

type Session = { user: { id: string } };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// Même chemin en preview qu'en prod : la connexion est réelle (auto-login user1
// en preview géré au niveau de la redirection — cf. loginRedirect/middleware).
export async function fetchSession(h: Headers): Promise<Session | null> {
  const cookie = h.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user?.id ? { user: { id: data.user.id } } : null;
}

function signInRedirectUrl(cookieHeader?: string | null): string {
  return loginRedirect({
    authUrl: env.AUTH_URL,
    back: env.APP_URL,
    preview: isPreview,
    cookieHeader: cookieHeader ?? null,
    defaultUser: DEFAULT_PREVIEW_USER,
  });
}

// Récupère l'id de l'utilisateur connecté ; redirige vers le SSO si pas de session.
export async function requireUserId(): Promise<string> {
  const h = await headers();
  const s = await fetchSession(h);
  if (!s) redirect(signInRedirectUrl(h.get("cookie")));
  return s.user.id;
}

// Variante non-redirigeante. Retourne undefined si pas de session.
export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  return s?.user.id;
}

// URL de déconnexion. En preview → preview-logout (efface la session + pose le
// marqueur → chooser). En prod → home du provider.
export function signOutUrl(): string {
  if (isPreview) {
    return `${env.AUTH_URL}/preview-logout?redirect=${encodeURIComponent(env.APP_URL)}`;
  }
  return env.AUTH_URL;
}
