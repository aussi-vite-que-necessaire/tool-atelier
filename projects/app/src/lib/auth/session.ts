import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { seedUserDefaults } from '@/lib/db/seeds/user-defaults';
import { DEFAULT_PREVIEW_USER, isPreview, loginRedirect } from './preview';

type Session = { user: { id: string } };

// Lit la session localement (auth in-app : même base, même origine). Plus de
// fetch HTTP vers un provider distant — l'instance BetterAuth tourne ici.
export async function fetchSession(h: Headers): Promise<Session | null> {
  const s = await auth.api.getSession({ headers: h });
  return s?.user?.id ? { user: { id: s.user.id } } : null;
}

function signInRedirectUrl(cookieHeader?: string | null): string {
  return loginRedirect({
    back: '/',
    preview: isPreview,
    cookieHeader: cookieHeader ?? null,
    defaultUser: DEFAULT_PREVIEW_USER,
  });
}

// URL/chemin de déconnexion. En preview → /preview-logout (efface la session +
// pose le marqueur → chooser). En prod → /signin (le bouton client appelle
// signOut() puis y renvoie ; ce lien reste un fallback sans JS).
export function signOutUrl(): string {
  if (isPreview) {
    return `/preview-logout?redirect=${encodeURIComponent('/')}`;
  }
  return '/signin';
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

export type SessionUser = { id: string; name: string; email: string };

// Identité d'affichage pour le menu utilisateur du shell. Renvoie undefined hors
// session (l'appelant a déjà passé la garde requireUserId pour la zone protégée).
export async function getSessionUser(): Promise<SessionUser | undefined> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user?.id) return undefined;
  return { id: s.user.id, name: s.user.name, email: s.user.email };
}

export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  if (!s) return undefined;
  await ensureSeeded(s.user.id);
  return s.user.id;
}
