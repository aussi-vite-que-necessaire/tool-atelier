import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isPreview, PREVIEW_USER_ID } from "@/lib/auth/preview";

type Session = { user: { id: string } };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// En preview, court-circuite avec PREVIEW_USER_ID — pas de fetch vers auth.
export async function fetchSession(h: Headers): Promise<Session | null> {
  if (isPreview) return { user: { id: PREVIEW_USER_ID } };
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

function signInRedirectUrl(): string {
  return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`;
}

// Récupère l'id de l'utilisateur connecté ; redirige vers le SSO si pas de session.
export async function requireUserId(): Promise<string> {
  const s = await fetchSession(await headers());
  if (!s) redirect(signInRedirectUrl());
  return s.user.id;
}

// Variante non-redirigeante. Retourne undefined si pas de session.
export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  return s?.user.id;
}
