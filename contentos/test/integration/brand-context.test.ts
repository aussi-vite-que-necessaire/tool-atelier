import { describe, expect, test } from 'vitest';
import { updateSettings, upsertSettings } from '@/lib/db/repositories/settings';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { createTestUser } from './helpers/seed';

describe('buildBrandContext', () => {
  test('mappe les réglages, signature vide → null, logo absent → chaîne vide', async () => {
    const userId = await createTestUser('bc-defaults');
    await upsertSettings(userId);

    const brand = await buildBrandContext(userId);

    expect(brand).toEqual({ name: '', signature: null, logo: '' });
  });

  test('expose nom, signature et logo renseignés', async () => {
    const userId = await createTestUser('bc-full');
    await upsertSettings(userId);
    await updateSettings(userId, {
      brandName: 'Acme',
      brandSignature: 'ACME.IO',
      brandLogoUrl: 'https://cdn.example/logo.png',
    });

    const brand = await buildBrandContext(userId);

    expect(brand).toEqual({
      name: 'Acme',
      signature: 'ACME.IO',
      logo: 'https://cdn.example/logo.png',
    });
  });

  test('défauts quand aucune row settings', async () => {
    const brand = await buildBrandContext('inexistant');
    expect(brand).toEqual({ name: '', signature: null, logo: '' });
  });
});
