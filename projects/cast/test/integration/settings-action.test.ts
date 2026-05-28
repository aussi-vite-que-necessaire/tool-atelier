import { describe, expect, test } from 'vitest';
import { updateBrandSettingsCore } from '@/app/(settings)/settings/brand/actions-core';
import { getSettings, upsertSettings } from '@/lib/db/repositories/settings';

// La table user vit côté auth.contentos.ch, plus locale ; on initialise juste
// les settings pour le user_id donné.
async function makeUser(id: string, _email: string) {
  await upsertSettings(id);
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateBrandSettingsCore', () => {
  test('success : met à jour les champs et retourne success', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateBrandSettingsCore(
      'u1',
      fd({
        brand_name: 'Acme',
        brand_signature: 'Signed',
      }),
    );
    expect(result).toEqual({ status: 'success' });

    const settings = await getSettings('u1');
    expect(settings?.brandName).toBe('Acme');
    expect(settings?.brandSignature).toBe('Signed');
  });

  test('validation error : brand_name trop long', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateBrandSettingsCore(
      'u1',
      fd({
        brand_name: 'x'.repeat(101),
        brand_signature: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.brand_name).toBeDefined();
    }
  });
});
