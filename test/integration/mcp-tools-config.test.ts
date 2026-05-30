import { describe, expect, test } from 'vitest';
import { configImpl } from '@/lib/mcp/tools/config';
import { createTestUser } from './helpers/seed';

describe('mcp tools — config', () => {
  test('create_publication_format puis list', async () => {
    const userId = await createTestUser('mcpfmt');
    const before = (await configImpl.listPublicationFormats(userId)).length;
    await configImpl.createPublicationFormat(userId, {
      name: 'Via MCP',
      platform: 'linkedin',
      structure: 'structure',
      visualIntent: 'carrousel',
    });
    const after = await configImpl.listPublicationFormats(userId);
    expect(after.length).toBe(before + 1);
    const created = after.find((t) => t.name === 'Via MCP');
    expect(created?.visualIntent).toBe('carrousel');
  });
});
