import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getAuthorizeUrl } from '@/lib/linkedin/oauth';

export async function GET(): Promise<Response> {
  await requireUserId();
  const state = randomUUID();
  const jar = await cookies();
  jar.set('li_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  if (env.CONTENT_OS_LINKEDIN_STUB === '1') {
    return NextResponse.redirect(
      new URL(`/api/linkedin/callback?code=stub&state=${state}`, env.APP_URL),
    );
  }
  return NextResponse.redirect(getAuthorizeUrl(state));
}
