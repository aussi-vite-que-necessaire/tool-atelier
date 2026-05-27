import { describe, expect, test } from 'vitest';
import { createStyleGuideCore } from '@/app/(settings)/settings/style-guides/new/actions-core';
import { db } from '@/lib/db/client';
import { listStyleGuides } from '@/lib/db/repositories/style-guides';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createStyleGuideCore', () => {
  test('success : crée le guide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createStyleGuideCore('u1', fd({ name: 'Sombre', content: '# md' }));
    expect(result.status).toBe('success');
    const rows = await listStyleGuides('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Sombre');
  });

  test('validation error : name vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createStyleGuideCore('u1', fd({ name: '', content: 'x' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.fieldErrors?.name).toBeDefined();
  });
});
