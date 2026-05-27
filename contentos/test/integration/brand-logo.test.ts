import { describe, expect, test } from 'vitest';
import { getSettings, upsertSettings } from '@/lib/db/repositories/settings';
import { removeBrandLogoCore, uploadBrandLogoCore } from '@/lib/media/brand-logo-core';
import { createTestUser } from './helpers/seed';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function makeFile(type: string, bytes: Buffer): File {
  return new File([new Uint8Array(bytes)], 'logo', { type });
}

describe('brand logo', () => {
  test('uploadBrandLogoCore enregistre l’URL du logo', async () => {
    const userId = await createTestUser('logo-ok');
    await upsertSettings(userId);

    const r = await uploadBrandLogoCore(userId, makeFile('image/png', PNG_1x1));

    expect(r.status).toBe('success');
    if (r.status !== 'success') throw new Error();
    expect(r.url).toBeTruthy();
    expect((await getSettings(userId))!.brandLogoUrl).toBe(r.url);
  });

  test('uploadBrandLogoCore rejette un format non supporté sans toucher au logo', async () => {
    const userId = await createTestUser('logo-bad');
    await upsertSettings(userId);

    const r = await uploadBrandLogoCore(userId, makeFile('image/gif', PNG_1x1));

    expect(r.status).toBe('error');
    expect((await getSettings(userId))!.brandLogoUrl).toBeNull();
  });

  test('removeBrandLogoCore efface le logo', async () => {
    const userId = await createTestUser('logo-rm');
    await upsertSettings(userId);
    await uploadBrandLogoCore(userId, makeFile('image/png', PNG_1x1));

    await removeBrandLogoCore(userId);

    expect((await getSettings(userId))!.brandLogoUrl).toBeNull();
  });
});
