import { describe, expect, test } from 'vitest';
import {
  deleteSocialAccount,
  getSocialAccount,
  upsertSocialAccount,
} from '@/lib/db/repositories/social-accounts';
import { createTestUser } from './helpers/seed';

const DATA = {
  platform: 'linkedin',
  externalId: 'urn:li:person:abc',
  displayName: 'Jean',
  accessToken: 'cipher',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: 'openid w_member_social',
};

describe('social-accounts repository', () => {
  test('upsert insère puis met à jour (reconnexion)', async () => {
    const u = await createTestUser('sa-up');
    const a = await upsertSocialAccount(u, DATA);
    expect(a.displayName).toBe('Jean');
    const b = await upsertSocialAccount(u, {
      ...DATA,
      displayName: 'Jean 2',
      accessToken: 'cipher2',
    });
    expect(b.id).toBe(a.id);
    expect(b.displayName).toBe('Jean 2');
    expect(b.accessToken).toBe('cipher2');
  });

  test('get scopé user', async () => {
    const a = await createTestUser('sa-a');
    const b = await createTestUser('sa-b');
    await upsertSocialAccount(a, DATA);
    expect(await getSocialAccount(a, 'linkedin')).toBeDefined();
    expect(await getSocialAccount(b, 'linkedin')).toBeUndefined();
  });

  test('delete scopé user', async () => {
    const a = await createTestUser('sa-del-a');
    const b = await createTestUser('sa-del-b');
    await upsertSocialAccount(a, DATA);
    await deleteSocialAccount(b, 'linkedin');
    expect(await getSocialAccount(a, 'linkedin')).toBeDefined();
    await deleteSocialAccount(a, 'linkedin');
    expect(await getSocialAccount(a, 'linkedin')).toBeUndefined();
  });
});
