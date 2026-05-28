import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
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

export async function requireUserId(): Promise<string> {
  const s = await fetchSession(await headers());
  if (!s) redirect(signInRedirectUrl());
  return s.user.id;
}

export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  return s?.user.id;
}
