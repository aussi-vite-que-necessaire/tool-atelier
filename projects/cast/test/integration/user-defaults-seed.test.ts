import { describe, expect, test } from 'vitest';
import { listVoices } from '@/lib/db/repositories/voice';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import {
  DEFAULT_VOICE_CONTENT,
  DEFAULT_WRITING_TEMPLATE,
  seedUserDefaults,
} from '@/lib/db/seeds/user-defaults';

// No-op : la table user vit côté auth.contentos.ch, plus locale.
async function makeUser(_id: string, _email: string) {}

describe('seedUserDefaults', () => {
  test('crée voice + writing_template par défaut', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');

    const voices = await listVoices('u1');
    expect(voices).toHaveLength(1);
    expect(voices[0]?.content).toBe(DEFAULT_VOICE_CONTENT);

    const templates = await listWritingTemplates('u1');
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe(DEFAULT_WRITING_TEMPLATE.name);
  });

  test('idempotent : deuxième appel ne duplique pas', async () => {
    await makeUser('u1', 'a@test.com');
    await seedUserDefaults('u1');
    await seedUserDefaults('u1');

    const templates = await listWritingTemplates('u1');
    expect(templates).toHaveLength(1);
    const voices = await listVoices('u1');
    expect(voices).toHaveLength(1);
  });
});
