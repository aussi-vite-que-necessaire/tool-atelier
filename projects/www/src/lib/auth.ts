// Auth déléguée au SSO de la suite — auth.contentos.ch.
// www n'a aucune donnée propre à l'utilisateur : l'auth sert uniquement de
// portail (être connecté pour voir le dashboard). On lit la session via un
// simple fetch HTTP vers le provider, en forwardant le cookie du browser (posé
// en cross-subdomain .contentos.ch). Aucun secret partagé, aucune table locale.

// URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
const AUTH_URL = process.env.AUTH_URL ?? "https://auth.contentos.ch";
// Origine publique de www (injectée par la plateforme). Sert de base au redirect.
const APP_URL = process.env.APP_URL ?? "http://localhost:8080";

// Le portail SSO n'est actif qu'en prod (APP_ENV='prod', posé par deploy.sh).
// En preview déployée (APP_ENV = slug de branche) comme en dev local (APP_ENV
// absent), on court-circuite : pas de auth.contentos.ch à joindre, accès ouvert.
const ssoEnabled = process.env.APP_ENV === "prod";

export type SessionUser = { id: string; email?: string };
export type Session = { user: SessionUser };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// Hors-prod, court-circuite avec une identité de preview.
export async function getSession(headers: Headers): Promise<Session | null> {
  if (!ssoEnabled) return { user: { id: "preview-user", email: "preview@www.local" } };
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user?.id ? { user: { id: data.user.id, email: data.user.email } } : null;
}

// URL de connexion du provider, avec retour vers le dashboard après login.
export function signInUrl(): string {
  return `${AUTH_URL}/sign-in?redirect=${encodeURIComponent(`${APP_URL}/dashboard`)}`;
}

// Page du provider (gère aussi la déconnexion via le cookie cross-domain).
export const authUrl = AUTH_URL;
