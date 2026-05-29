import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { seedUserDefaults } from '@/lib/db/seeds/user-defaults';
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from './preview';

type Session = { user: { id: string } };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// Même chemin en preview qu'en prod : la connexion est réelle (auto-login user1
// en preview géré au niveau de la redirection — cf. loginRedirect/middleware).
export async function fetchSession(h: Headers): Promise<Session | null> {
  const cookie = h.get('cookie');
  if (!cookie) return null;
  const res = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: 'no-store',
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

// URL de déconnexion. En preview → preview-logout (efface la session + pose le
// marqueur → chooser). En prod → home du provider.
export function signOutUrl(): string {
  if (isPreview) {
    return `${env.AUTH_URL}/preview-logout?redirect=${encodeURIComponent(env.APP_URL)}`;
  }
  return env.AUTH_URL;
}

// Cache process-level pour éviter de retaper la DB à chaque requête.
// seedUserDefaults est idempotent côté DB (SELECT-then-insert), mais on évite
// le round-trip si on a déjà vu cet user dans cette instance de worker.
const seeded = new Set<string>();

async function ensureSeeded(userId: string): Promise<void> {
  if (seeded.has(userId)) return;
  await seedUserDefaults(userId);
  seeded.add(userId);
}

export async function requireUserId(): Promise<string> {
  const h = await headers();
  const s = await fetchSession(h);
  if (!s) redirect(signInRedirectUrl(h.get('cookie')));
  await ensureSeeded(s.user.id);
  return s.user.id;
}

export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  if (!s) return undefined;
  await ensureSeeded(s.user.id);
  return s.user.id;
}
