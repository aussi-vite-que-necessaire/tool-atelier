import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

// Le userId provient de la passerelle MCP (de confiance), déposé dans
// authInfo.extra par le contrat interne. Les tools le lisent via ce helper.
export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('userId manquant dans le token');
  return userId;
}
