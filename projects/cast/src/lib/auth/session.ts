import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { seedUserDefaults } from '@/lib/db/seeds/user-defaults';
import { isPreview, PREVIEW_USER_ID } from './preview';

type Session = { user: { id: string } };

// Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
// En preview, court-circuite avec le PREVIEW_USER_ID seedé.
export async function fetchSession(h: Headers): Promise<Session | null> {
  if (isPreview) return { user: { id: PREVIEW_USER_ID } };
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

function signInRedirectUrl(): string {
  return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`;
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
  const s = await fetchSession(await headers());
  if (!s) redirect(signInRedirectUrl());
  await ensureSeeded(s.user.id);
  return s.user.id;
}

export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  if (!s) return undefined;
  await ensureSeeded(s.user.id);
  return s.user.id;
}
