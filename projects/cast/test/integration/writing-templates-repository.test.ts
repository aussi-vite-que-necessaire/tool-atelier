import { describe, expect, test } from 'vitest';
import {
  createWritingTemplate,
  deleteWritingTemplate,
  getWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';

// No-op : la table user vit côté auth.contentos.ch, plus locale.
async function makeUser(_id: string, _email: string) {}

const SAMPLE = {
  name: 'Sample',
  platform: 'linkedin',
  structure: 'HOOK / CORPS / CLOSURE',
  writingRules: null,
};

describe('writing_templates repository', () => {
  test('createWritingTemplate insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const t = await createWritingTemplate('u1', SAMPLE);
    expect(t?.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(t?.userId).toBe('u1');
    expect(t?.name).toBe('Sample');
    expect(t?.platform).toBe('linkedin');
    expect(t?.writingRules).toBeNull();
  });

  test('getWritingTemplate retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    const found = await getWritingTemplate('u1', created!.id);
    expect(found?.name).toBe('Sample');
  });

  test('listWritingTemplates retourne tous les templates du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createWritingTemplate('u1', SAMPLE);
    await createWritingTemplate('u1', { ...SAMPLE, name: 'Sample 2' });
    const rows = await listWritingTemplates('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateWritingTemplate modifie name + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    const before = created!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateWritingTemplate('u1', created!.id, { name: 'Renommé' });
    expect(updated?.name).toBe('Renommé');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteWritingTemplate supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', SAMPLE);
    await deleteWritingTemplate('u1', created!.id);
    expect(await getWritingTemplate('u1', created!.id)).toBeUndefined();
  });
});
