import { describe, expect, test } from 'vitest';
import {
  deletePublicationFormatCore,
  updatePublicationFormatCore,
} from '@/app/(app)/cast/settings/formats/[id]/actions-core';
import {
  createPublicationFormat,
  getPublicationFormat,
} from '@/lib/db/repositories/publication-formats';

// No-op : la table user vit côté auth, plus locale.
async function makeUser(_id: string, _email: string) {}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updatePublicationFormatCore', () => {
  test('success : modifie le name et l’intention visuelle', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createPublicationFormat('u1', {
      name: 'Orig',
      platform: 'linkedin',
      structure: 'S',
      visualIntent: null,
      writingRules: null,
    });
    const result = await updatePublicationFormatCore(
      'u1',
      created!.id,
      fd({
        name: 'Renommé',
        platform: 'linkedin',
        structure: 'S',
        visualIntent: 'citation',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('success');

    const fresh = await getPublicationFormat('u1', created!.id);
    expect(fresh?.name).toBe('Renommé');
    expect(fresh?.visualIntent).toBe('citation');
  });

  test('update sur format d’un autre user : 404', async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createPublicationFormat('u1', {
      name: 'X',
      platform: 'linkedin',
      structure: 'S',
      visualIntent: null,
      writingRules: null,
    });
    const result = await updatePublicationFormatCore(
      'u2',
      owned!.id,
      fd({
        name: 'Hacked',
        platform: 'linkedin',
        structure: 'S',
        visualIntent: '',
        writingRules: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('not-found');
    }

    const stillOwned = await getPublicationFormat('u1', owned!.id);
    expect(stillOwned?.name).toBe('X');
  });
});

describe('deletePublicationFormatCore', () => {
  test('success : supprime le format du user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createPublicationFormat('u1', {
      name: 'X',
      platform: 'linkedin',
      structure: 'S',
      visualIntent: null,
      writingRules: null,
    });
    const result = await deletePublicationFormatCore('u1', created!.id);
    expect(result.status).toBe('success');
    expect(await getPublicationFormat('u1', created!.id)).toBeUndefined();
  });
});
