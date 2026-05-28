import { describe, expect, test } from 'vitest';
import {
  deleteWritingTemplateCore,
  updateWritingTemplateCore,
} from '@/app/(settings)/settings/writing-templates/[id]/actions-core';
import { db } from '@/lib/db/client';
import { createWritingTemplate, getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateWritingTemplateCore', () => {
  test('success : modifie le name', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', {
      name: 'Orig',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await updateWritingTemplateCore(
      'u1',
      created!.id,
      fd({ name: 'Renommé', platform: 'linkedin', structure: 'S', writingRules: '' }),
    );
    expect(result.status).toBe('success');

    const fresh = await getWritingTemplate('u1', created!.id);
    expect(fresh?.name).toBe('Renommé');
  });

  test("update sur template d'un autre user : 404", async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const owned = await createWritingTemplate('u1', {
      name: 'X',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await updateWritingTemplateCore(
      'u2',
      owned!.id,
      fd({ name: 'Hacked', platform: 'linkedin', structure: 'S', writingRules: '' }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('not-found');
    }

    const stillOwned = await getWritingTemplate('u1', owned!.id);
    expect(stillOwned?.name).toBe('X');
  });
});

describe('deleteWritingTemplateCore', () => {
  test('success : supprime le template du user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createWritingTemplate('u1', {
      name: 'X',
      platform: 'linkedin',
      structure: 'S',
      writingRules: null,
    });
    const result = await deleteWritingTemplateCore('u1', created!.id);
    expect(result.status).toBe('success');
    expect(await getWritingTemplate('u1', created!.id)).toBeUndefined();
  });
});
