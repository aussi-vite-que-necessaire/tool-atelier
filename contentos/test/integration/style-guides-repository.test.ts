import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createStyleGuide,
  deleteStyleGuide,
  getStyleGuide,
  listStyleGuides,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  name: 'Éditorial sombre',
  content: '# Palette\n- #0a0a0a\n- #f5f5f5\n\n## Typo\nInter via Google Fonts.',
};

describe('style_guides repository', () => {
  test('createStyleGuide insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', SAMPLE);
    expect(g.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(g.userId).toBe('u1');
    expect(g.name).toBe('Éditorial sombre');
    expect(g.content).toBe(SAMPLE.content);
  });

  test('getStyleGuide retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    const found = await getStyleGuide('u1', created.id);
    expect(found?.name).toBe('Éditorial sombre');
  });

  test('listStyleGuides retourne tous les guides du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createStyleGuide('u1', SAMPLE);
    await createStyleGuide('u1', { ...SAMPLE, name: 'Clair' });
    expect(await listStyleGuides('u1')).toHaveLength(2);
  });

  test('updateStyleGuide modifie content + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateStyleGuide('u1', created.id, { content: 'nouveau' });
    expect(updated?.content).toBe('nouveau');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteStyleGuide supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    await deleteStyleGuide('u1', created.id);
    expect(await getStyleGuide('u1', created.id)).toBeUndefined();
  });
});
