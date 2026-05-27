import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { getSettings, updateSettings, upsertSettings } from '@/lib/db/repositories/settings';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('settings repository', () => {
  test('upsertSettings crée une row vide', async () => {
    await makeUser('u1', 'a@test.com');
    const s = await upsertSettings('u1');
    expect(s.userId).toBe('u1');
    expect(s.brandName).toBe('');
  });

  test('upsertSettings est idempotent', async () => {
    await makeUser('u1', 'a@test.com');
    await upsertSettings('u1');
    const s = await upsertSettings('u1');
    expect(s.userId).toBe('u1');
  });

  test('updateSettings met à jour les champs et updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    await upsertSettings('u1');
    const before = (await getSettings('u1'))!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateSettings('u1', { brandName: 'Acme' });
    expect(updated?.brandName).toBe('Acme');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('updateSettings enregistre puis efface le logo', async () => {
    await makeUser('u1', 'a@test.com');
    await upsertSettings('u1');
    expect((await getSettings('u1'))!.brandLogoUrl).toBeNull();

    const set = await updateSettings('u1', { brandLogoUrl: 'https://cdn.example/logo.png' });
    expect(set?.brandLogoUrl).toBe('https://cdn.example/logo.png');

    const cleared = await updateSettings('u1', { brandLogoUrl: null });
    expect(cleared?.brandLogoUrl).toBeNull();
  });

  test('getSettings retourne undefined pour user inexistant', async () => {
    const s = await getSettings('nonexistent');
    expect(s).toBeUndefined();
  });
});
