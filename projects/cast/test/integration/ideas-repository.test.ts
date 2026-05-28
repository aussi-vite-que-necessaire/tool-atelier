import { describe, expect, it, test } from 'vitest';
import {
  createIdea,
  deleteIdea,
  getIdea,
  listIdeas,
  updateIdea,
} from '@/lib/db/repositories/ideas';
import { createTestUser } from './helpers/seed';

// No-op : la table user vit côté auth.contentos.ch, plus locale ;
// l'id reste juste une string utilisée par les FK soft (user_id sans FK).
async function makeUser(_id: string, _email: string) {}

describe('ideas repository', () => {
  test('createIdea insère une row avec id généré', async () => {
    await makeUser('u1', 'a@test.com');
    const idea = await createIdea('u1', { idea: 'concept' });
    expect(idea.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(idea.userId).toBe('u1');
    expect(idea.idea).toBe('concept');
    expect(idea.brief).toBeNull();
  });

  test('getIdea retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'concept', brief: 'detail' });
    const found = await getIdea('u1', created.id);
    expect(found?.idea).toBe('concept');
    expect(found?.brief).toBe('detail');
  });

  test('listIdeas retourne toutes les ideas du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createIdea('u1', { idea: 'first' });
    await createIdea('u1', { idea: 'second' });
    const rows = await listIdeas('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateIdea modifie les champs + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'old' });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateIdea('u1', created.id, { idea: 'new', brief: 'added' });
    expect(updated?.idea).toBe('new');
    expect(updated?.brief).toBe('added');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteIdea supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'doomed' });
    await deleteIdea('u1', created.id);
    expect(await getIdea('u1', created.id)).toBeUndefined();
  });
});

describe('listIdeas ordering', () => {
  it('returns ideas sorted by updated_at DESC', async () => {
    const userId = await createTestUser('listideas');
    const a = await createIdea(userId, { idea: 'A' });
    await new Promise((r) => setTimeout(r, 10));
    const b = await createIdea(userId, { idea: 'B' });
    await new Promise((r) => setTimeout(r, 10));
    await updateIdea(userId, a.id, { idea: 'A bis' });

    const list = await listIdeas(userId);
    expect(list.map((i) => i.id)).toEqual([a.id, b.id]);
  });
});
