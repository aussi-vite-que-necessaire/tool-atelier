import { describe, expect, test } from 'vitest';
import { createVisualStyleCore } from '@/app/(settings)/settings/visual-styles/new/actions-core';
import { db } from '@/lib/db/client';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createVisualStyleCore', () => {
  test('success : crée le style', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVisualStyleCore(
      'u1',
      fd({ name: 'Cinematic', prompt: 'rendu cinéma' }),
    );
    expect(result.status).toBe('success');

    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Cinematic');
  });

  test('validation error : name vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVisualStyleCore('u1', fd({ name: '', prompt: 'P' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.name).toBeDefined();
    }
  });
});
