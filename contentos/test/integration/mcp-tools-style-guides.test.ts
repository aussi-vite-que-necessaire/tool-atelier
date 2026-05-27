import { describe, expect, test } from 'vitest';
import { styleGuideImpl } from '@/lib/mcp/tools/style-guides';
import { visualImpl } from '@/lib/mcp/tools/visuals';
import { createTestUser } from './helpers/seed';

describe('mcp tools — style guides', () => {
  test('create → list → update → delete', async () => {
    const userId = await createTestUser('sg');
    const g = await styleGuideImpl.create(userId, { name: 'Sombre', content: '# palette' });
    expect((await styleGuideImpl.list(userId)).some((x) => x.id === g.id)).toBe(true);
    const upd = await styleGuideImpl.update(userId, { id: g.id, name: 'Sombre 2' });
    expect(upd?.name).toBe('Sombre 2');
    await styleGuideImpl.delete(userId, { id: g.id });
    expect((await styleGuideImpl.list(userId)).some((x) => x.id === g.id)).toBe(false);
  });

  test('get renvoie le markdown + refs légères des templates rattachés', async () => {
    const userId = await createTestUser('sgget');
    const g = await styleGuideImpl.create(userId, { name: 'G', content: '# md' });
    await visualImpl.createTemplate(userId, {
      slug: 'sg-tpl',
      label: 'SG TPL',
      platform: 'linkedin',
      width: 1080,
      height: 1080,
      bodyHtml: '<div>{{t}}</div>',
      css: 'div{}',
      variablesSchema: [{ name: 't', label: 'T', type: 'string' as const, max: 200 }],
      sampleVars: { t: 'x' },
      styleGuideId: g.id,
    });
    const got = await styleGuideImpl.get(userId, { id: g.id });
    expect(got.content).toBe('# md');
    expect(got.templates).toEqual([{ id: expect.any(String), label: 'SG TPL', slug: 'sg-tpl' }]);
  });

  test('get sur un id inconnu → throw', async () => {
    const userId = await createTestUser('sgko');
    await expect(styleGuideImpl.get(userId, { id: 'nope' })).rejects.toThrow(/introuvable/);
  });
});
