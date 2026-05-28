import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { auth } from '@/lib/auth/server';

// Valide un access token OAuth (émis par better-auth) et en extrait le userId.
// getMcpSession lit le bearer de l'en-tête Authorization et résout la ligne
// oauthAccessToken correspondante.
export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? 'content-os-mcp',
    scopes: typeof session.scopes === 'string' ? session.scopes.split(' ').filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}

export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('userId manquant dans le token');
  return userId;
}
