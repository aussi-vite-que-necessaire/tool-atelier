import { describe, expect, test } from 'vitest';
import {
  deleteVisualStyleCore,
  updateVisualStyleCore,
} from '@/app/(settings)/settings/visual-styles/[id]/actions-core';
import { db } from '@/lib/db/client';
import { createVisualStyle, getVisualStyle } from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateVisualStyleCore', () => {
  test('success : modifie le prompt', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', { name: 'X', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u1',
      created.id,
      fd({ name: 'X', prompt: 'nouveau' }),
    );
    expect(result.status).toBe('success');
    expect((await getVisualStyle('u1', created.id))?.prompt).toBe('nouveau');
  });

  test("update sur style d'un autre user : not-found", async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createVisualStyle('u1', { name: 'X', prompt: 'orig' });
    const result = await updateVisualStyleCore(
      'u2',
      owned.id,
      fd({ name: 'Hacked', prompt: 'hacked' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('not-found');
    }
  });
});

describe('deleteVisualStyleCore', () => {
  test('success : supprime', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', { name: 'X', prompt: 'P' });
    const result = await deleteVisualStyleCore('u1', created.id);
    expect(result.status).toBe('success');
    expect(await getVisualStyle('u1', created.id)).toBeUndefined();
  });
});
