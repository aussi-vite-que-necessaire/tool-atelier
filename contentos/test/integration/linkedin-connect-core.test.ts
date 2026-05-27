import { describe, expect, test } from 'vitest';
import { decryptToken } from '@/lib/crypto';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { connectFromCode } from '@/lib/linkedin/connect-core';
import type { ExchangeFn } from '@/lib/linkedin/oauth';
import { createTestUser } from './helpers/seed';

const fakeExchange: ExchangeFn = async () => ({
  externalId: 'urn:li:person:Z',
  displayName: 'Zoé',
  accessToken: 'clear-token-123',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: 'openid w_member_social',
});

describe('connectFromCode', () => {
  test('crée un social_account avec token chiffré', async () => {
    const userId = await createTestUser('cfc');
    await connectFromCode(userId, 'code', fakeExchange);
    const account = await getSocialAccount(userId, 'linkedin');
    expect(account?.displayName).toBe('Zoé');
    expect(account?.externalId).toBe('urn:li:person:Z');
    expect(account?.accessToken).not.toBe('clear-token-123');
    expect(decryptToken(account!.accessToken)).toBe('clear-token-123');
  });
});
