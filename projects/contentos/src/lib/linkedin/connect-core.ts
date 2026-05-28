import { encryptToken } from '@/lib/crypto';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import type { ExchangeFn } from './oauth';

export async function connectFromCode(
  userId: string,
  code: string,
  exchange: ExchangeFn,
): Promise<void> {
  const conn = await exchange(code);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: conn.externalId,
    displayName: conn.displayName,
    accessToken: encryptToken(conn.accessToken),
    expiresAt: conn.expiresAt,
    scopes: conn.scopes,
  });
}
