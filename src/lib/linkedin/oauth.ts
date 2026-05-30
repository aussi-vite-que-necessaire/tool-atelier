import { env } from '@/lib/env';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPES = 'openid profile email w_member_social';
const REDIRECT_PATH = '/api/linkedin/callback';

function redirectUri(): string {
  return `${env.APP_URL}${REDIRECT_PATH}`;
}

export function getAuthorizeUrl(state: string): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', env.LINKEDIN_CLIENT_ID ?? '');
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

export type LinkedInConnection = {
  externalId: string;
  displayName: string;
  accessToken: string;
  expiresAt: Date;
  scopes: string;
};

export type ExchangeFn = (code: string) => Promise<LinkedInConnection>;

export const exchangeCodeStub: ExchangeFn = async () => ({
  externalId: 'urn:li:person:STUB',
  displayName: 'Compte LinkedIn (stub)',
  accessToken: 'stub-token',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: SCOPES,
});

export const exchangeCodeReal: ExchangeFn = async (code) => {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  });
  if (!tokenRes.ok) throw new Error(`LinkedIn token exchange failed: ${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token: string; expires_in: number };

  const meRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) throw new Error(`LinkedIn userinfo failed: ${meRes.status}`);
  const me = (await meRes.json()) as { sub: string; name?: string };

  return {
    externalId: `urn:li:person:${me.sub}`,
    displayName: me.name ?? 'LinkedIn',
    accessToken: token.access_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: SCOPES,
  };
};

export const exchangeCode: ExchangeFn =
  env.CONTENT_OS_LINKEDIN_STUB === '1' ? exchangeCodeStub : exchangeCodeReal;
