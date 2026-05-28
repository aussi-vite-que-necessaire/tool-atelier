import { describe, expect, test } from 'vitest';
import { configImpl } from '@/lib/mcp/tools/config';
import { createTestUser } from './helpers/seed';

describe('mcp tools — config', () => {
  test('create_writing_template puis list', async () => {
    const userId = await createTestUser('mcptpl');
    const before = (await configImpl.listWritingTemplates(userId)).length;
    await configImpl.createWritingTemplate(userId, {
      name: 'Via MCP',
      platform: 'linkedin',
      structure: 'structure',
    });
    const after = await configImpl.listWritingTemplates(userId);
    expect(after.length).toBe(before + 1);
    expect(after.some((t) => t.name === 'Via MCP')).toBe(true);
  });
});
