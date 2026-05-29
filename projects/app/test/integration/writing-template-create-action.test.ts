import { describe, expect, test } from 'vitest';
import { createWritingTemplateCore } from '@/app/(app)/cast/settings/writing-templates/new/actions-core';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';

// No-op : la table user vit côté auth.contentos.ch, plus locale.
async function makeUser(_id: string, _email: string) {}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createWritingTemplateCore', () => {
  test('success : crée le template', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createWritingTemplateCore(
      'u1',
      fd({
        name: 'Carrousel LinkedIn',
        platform: 'linkedin',
        structure: 'HOOK / 5-7 slides / CTA',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('success');

    const rows = await listWritingTemplates('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Carrousel LinkedIn');
  });

  test('validation error : nom manquant', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createWritingTemplateCore(
      'u1',
      fd({ name: '', platform: 'linkedin', structure: 'S', writingRules: '' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.fieldErrors?.name).toBeDefined();
  });
});
