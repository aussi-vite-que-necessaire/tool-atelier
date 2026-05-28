import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { connectFromCode } from '@/lib/linkedin/connect-core';
import { exchangeCode } from '@/lib/linkedin/oauth';

export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const jar = await cookies();
  const expected = jar.get('li_oauth_state')?.value;
  jar.delete('li_oauth_state');

  const settings = new URL('/settings/connections', env.APP_URL);
  if (!code || !state || !expected || state !== expected) {
    settings.searchParams.set('error', 'state');
    return NextResponse.redirect(settings);
  }

  try {
    await connectFromCode(userId, code, exchangeCode);
    settings.searchParams.set('connected', '1');
  } catch {
    settings.searchParams.set('error', 'oauth');
  }
  return NextResponse.redirect(settings);
}
