import { describe, expect, test } from 'vitest';
import {
  createPublicationFormat,
  deletePublicationFormat,
  getPublicationFormat,
  listPublicationFormats,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';

// No-op : la table user vit côté auth, plus locale.
async function makeUser(_id: string, _email: string) {}

const SAMPLE = {
  name: 'Sample',
  platform: 'linkedin',
  structure: 'HOOK / CORPS / CLOSURE',
  visualIntent: null,
  writingRules: null,
};

describe('publication_formats repository', () => {
  test('createPublicationFormat insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const t = await createPublicationFormat('u1', SAMPLE);
    expect(t?.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(t?.userId).toBe('u1');
    expect(t?.platform).toBe('linkedin');
    expect(t?.visualIntent).toBeNull();
    expect(t?.writingRules).toBeNull();
  });

  test('visualIntent est persisté quand fourni', async () => {
    const t = await createPublicationFormat('u1', { ...SAMPLE, visualIntent: 'carrousel 5-7 slides' });
    const found = await getPublicationFormat('u1', t!.id);
    expect(found?.visualIntent).toBe('carrousel 5-7 slides');
  });

  test('getPublicationFormat retourne la row pour le bon user', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    const found = await getPublicationFormat('u1', created!.id);
    expect(found?.name).toBe('Sample');
  });

  test('listPublicationFormats retourne tous les formats du user', async () => {
    await createPublicationFormat('u1', SAMPLE);
    await createPublicationFormat('u1', { ...SAMPLE, name: 'Sample 2' });
    const rows = await listPublicationFormats('u1');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('updatePublicationFormat modifie visualIntent + updated_at', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    const before = created!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePublicationFormat('u1', created!.id, { visualIntent: 'citation' });
    expect(updated?.visualIntent).toBe('citation');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePublicationFormat supprime la row', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    await deletePublicationFormat('u1', created!.id);
    expect(await getPublicationFormat('u1', created!.id)).toBeUndefined();
  });
});
