import { describe, expect, test } from 'vitest';
import { updateVoiceCore } from '@/app/(settings)/settings/voice/[id]/actions-core';
import { createVoiceCore } from '@/app/(settings)/settings/voice/new/actions-core';
import { db } from '@/lib/db/client';
import { createVoice, getVoice, listVoices } from '@/lib/db/repositories/voice';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createVoiceCore', () => {
  test('success : crée une voix', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVoiceCore('u1', fd({ name: 'Pro', content: 'ton pro' }));
    expect(result).toEqual({ status: 'success' });
    const voices = await listVoices('u1');
    expect(voices).toHaveLength(1);
    expect(voices[0]?.name).toBe('Pro');
  });

  test('validation error : nom vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createVoiceCore('u1', fd({ name: '', content: 'x' }));
    expect(result.status).toBe('error');
    expect(await listVoices('u1')).toHaveLength(0);
  });
});

describe('updateVoiceCore', () => {
  test('success : met à jour le contenu', async () => {
    await makeUser('u1', 'a@test.com');
    const v = await createVoice('u1', { name: 'Pro', content: 'avant' });
    const result = await updateVoiceCore('u1', v.id, fd({ name: 'Pro', content: 'après' }));
    expect(result).toEqual({ status: 'success' });
    expect((await getVoice('u1', v.id))?.content).toBe('après');
  });

  test('error : voix introuvable', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateVoiceCore('u1', 'inexistant', fd({ name: 'Pro', content: 'x' }));
    expect(result.status).toBe('error');
  });

  test('validation error : contenu vide', async () => {
    await makeUser('u1', 'a@test.com');
    const v = await createVoice('u1', { name: 'Pro', content: 'avant' });
    const result = await updateVoiceCore('u1', v.id, fd({ name: 'Pro', content: '' }));
    expect(result.status).toBe('error');
    expect((await getVoice('u1', v.id))?.content).toBe('avant');
  });
});
