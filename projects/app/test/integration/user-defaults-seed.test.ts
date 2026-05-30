import { describe, expect, test } from 'vitest';
import { listPublicationFormats } from '@/lib/db/repositories/publication-formats';
import { listVoices } from '@/lib/db/repositories/voice';
import {
  DEFAULT_PUBLICATION_FORMAT,
  DEFAULT_VOICE_CONTENT,
  seedUserDefaults,
} from '@/lib/db/seeds/user-defaults';

// No-op : la table user vit côté auth.contentos.ch, plus locale.
async function makeUser(_id: string, _email: string) {}

describe('seedUserDefaults', () => {
  test('crée voice + publication_format par défaut', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');

    const voices = await listVoices('u1');
    expect(voices).toHaveLength(1);
    expect(voices[0]?.content).toBe(DEFAULT_VOICE_CONTENT);

    const formats = await listPublicationFormats('u1');
    expect(formats).toHaveLength(1);
    expect(formats[0]?.name).toBe(DEFAULT_PUBLICATION_FORMAT.name);
  });

  test('idempotent : deuxième appel ne duplique pas', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');
    await seedUserDefaults('u1');

    const formats = await listPublicationFormats('u1');
    expect(formats).toHaveLength(1);
    const voices = await listVoices('u1');
    expect(voices).toHaveLength(1);
  });
});
