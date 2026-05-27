import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createId } from '@/lib/db/id';
import { oauthAccessToken, oauthApplication } from '@/lib/db/schema';
import { verifyMcpToken } from '@/lib/mcp/auth';
import { createTestUser } from './helpers/seed';

async function seedAccessToken(userId: string, token: string): Promise<void> {
  const clientId = `client_${createId()}`;
  await db.insert(oauthApplication).values({
    id: createId(),
    name: 'Test client',
    clientId,
    redirectUrls: 'https://example.test/callback',
    type: 'web',
  });
  const inAnHour = new Date(Date.now() + 3600_000);
  await db.insert(oauthAccessToken).values({
    id: createId(),
    accessToken: token,
    refreshToken: `rt_${createId()}`,
    accessTokenExpiresAt: inAnHour,
    refreshTokenExpiresAt: inAnHour,
    clientId,
    userId,
    scopes: 'openid profile',
  });
}

describe('mcp auth — OAuth', () => {
  test('verifyMcpToken résout le userId depuis un access token OAuth', async () => {
    const userId = await createTestUser('mcpoauth');
    const token = `at_${createId()}`;
    await seedAccessToken(userId, token);

    const req = new Request('https://x/api/mcp', {
      headers: { authorization: `Bearer ${token}` },
    });
    const info = await verifyMcpToken(req);
    expect(info?.extra?.userId).toBe(userId);
  });

  test('verifyMcpToken renvoie undefined sans bearer', async () => {
    const info = await verifyMcpToken(new Request('https://x/api/mcp'));
    expect(info).toBeUndefined();
  });

  test('verifyMcpToken renvoie undefined pour un token inconnu', async () => {
    const req = new Request('https://x/api/mcp', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(await verifyMcpToken(req)).toBeUndefined();
  });
});
