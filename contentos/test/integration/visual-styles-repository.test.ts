import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createVisualStyle,
  deleteVisualStyle,
  getVisualStyle,
  listVisualStyles,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  name: 'Cinematic',
  prompt: 'rendu cinématographique, lumière diffuse',
};

describe('visual_styles repository', () => {
  test('createVisualStyle insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const s = await createVisualStyle('u1', SAMPLE);
    expect(s.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(s.userId).toBe('u1');
    expect(s.name).toBe('Cinematic');
    expect(s.prompt).toBe(SAMPLE.prompt);
  });

  test('getVisualStyle retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const found = await getVisualStyle('u1', created.id);
    expect(found?.name).toBe('Cinematic');
  });

  test('listVisualStyles retourne tous les styles du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createVisualStyle('u1', SAMPLE);
    await createVisualStyle('u1', { ...SAMPLE, name: 'Cinematic 2' });
    const rows = await listVisualStyles('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateVisualStyle modifie prompt + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVisualStyle('u1', created.id, { prompt: 'nouveau prompt' });
    expect(updated?.prompt).toBe('nouveau prompt');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteVisualStyle supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVisualStyle('u1', SAMPLE);
    await deleteVisualStyle('u1', created.id);
    expect(await getVisualStyle('u1', created.id)).toBeUndefined();
  });
});
