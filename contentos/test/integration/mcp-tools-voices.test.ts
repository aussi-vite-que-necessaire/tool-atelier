import { describe, expect, test } from 'vitest';
import { listVoices } from '@/lib/db/repositories/voice';
import { voiceImpl } from '@/lib/mcp/tools/voices';
import { createTestUser } from './helpers/seed';

describe('mcp tools — voices', () => {
  test('create puis list', async () => {
    const userId = await createTestUser('mcp-voice-create');
    await voiceImpl.create(userId, { name: 'Pro', content: 'ton pro' });
    const voices = await voiceImpl.list(userId);
    expect(voices.some((v) => v.name === 'Pro')).toBe(true);
  });

  test('update modifie le contenu', async () => {
    const userId = await createTestUser('mcp-voice-update');
    const created = await voiceImpl.create(userId, { name: 'Pro', content: 'avant' });
    await voiceImpl.update(userId, { id: created.id, content: 'après' });
    const voices = await voiceImpl.list(userId);
    expect(voices.find((v) => v.id === created.id)?.content).toBe('après');
  });

  test('remove supprime la voix', async () => {
    const userId = await createTestUser('mcp-voice-remove');
    const created = await voiceImpl.create(userId, { name: 'Pro', content: 'x' });
    const result = await voiceImpl.remove(userId, { id: created.id });
    expect(result).toEqual({ deleted: created.id });
    expect(await listVoices(userId)).toHaveLength(0);
  });
});
