import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createVoice,
  deleteVoice,
  getVoice,
  listVoices,
  updateVoice,
} from '@/lib/db/repositories/voice';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('voice repository', () => {
  test('listVoices retourne [] si aucune voix', async () => {
    await makeUser('u1', 'a@test.com');
    expect(await listVoices('u1')).toEqual([]);
  });

  test('createVoice + listVoices : plusieurs voix par user', async () => {
    await makeUser('u1', 'a@test.com');
    await createVoice('u1', { name: 'Pro', content: 'ton pro' });
    await createVoice('u1', { name: 'Perso', content: 'ton perso' });
    const voices = await listVoices('u1');
    expect(voices.map((v) => v.name).sort()).toEqual(['Perso', 'Pro']);
  });

  test('getVoice retourne undefined hors scope user', async () => {
    await makeUser('u1', 'a@test.com');
    await makeUser('u2', 'b@test.com');
    const v = await createVoice('u1', { name: 'Pro', content: 'ton pro' });
    expect(await getVoice('u2', v.id)).toBeUndefined();
    expect((await getVoice('u1', v.id))?.name).toBe('Pro');
  });

  test('updateVoice modifie nom/contenu + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createVoice('u1', { name: 'Pro', content: 'avant' });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVoice('u1', created.id, { content: 'après' });
    expect(updated?.content).toBe('après');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteVoice retire la voix', async () => {
    await makeUser('u1', 'a@test.com');
    const v = await createVoice('u1', { name: 'Pro', content: 'x' });
    await deleteVoice('u1', v.id);
    expect(await listVoices('u1')).toEqual([]);
  });
});
