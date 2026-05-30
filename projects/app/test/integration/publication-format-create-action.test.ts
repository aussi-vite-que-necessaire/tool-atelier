import { describe, expect, test } from 'vitest';
import { createPublicationFormatCore } from '@/app/(app)/cast/settings/formats/new/actions-core';
import { listPublicationFormats } from '@/lib/db/repositories/publication-formats';

// No-op : la table user vit côté auth, plus locale.
async function makeUser(_id: string, _email: string) {}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createPublicationFormatCore', () => {
  test('success : crée le format avec son intention visuelle', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createPublicationFormatCore(
      'u1',
      fd({
        name: 'Carrousel LinkedIn',
        platform: 'linkedin',
        structure: 'HOOK / 5-7 slides / CTA',
        visualIntent: 'carrousel 5-7 slides',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('success');

    const rows = await listPublicationFormats('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Carrousel LinkedIn');
    expect(rows[0]?.visualIntent).toBe('carrousel 5-7 slides');
  });

  test('validation error : nom manquant', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createPublicationFormatCore(
      'u1',
      fd({ name: '', platform: 'linkedin', structure: 'S', visualIntent: '', writingRules: '' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.fieldErrors?.name).toBeDefined();
  });
});
