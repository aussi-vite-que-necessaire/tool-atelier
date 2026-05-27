import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createStyleGuide, deleteStyleGuide } from '@/lib/db/repositories/style-guides';
import {
  createVisualTemplate,
  getVisualTemplate,
  listVisualTemplatesByStyleGuide,
} from '@/lib/db/repositories/visual-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const TPL = {
  slug: 'lien-tpl',
  label: 'Lien',
  platform: 'linkedin',
  width: 1080,
  height: 1080,
  bodyHtml: '<div>{{t}}</div>',
  css: 'div{}',
  variablesSchema: [{ name: 't', label: 'T', type: 'string' as const }],
  sampleVars: { t: 'x' },
};

describe('lien visual_template ↔ style_guide', () => {
  test('createVisualTemplate persiste styleGuideId', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    const tpl = await createVisualTemplate('u1', { ...TPL, styleGuideId: g.id });
    expect(tpl?.styleGuideId).toBe(g.id);
  });

  test('listVisualTemplatesByStyleGuide ne renvoie que les templates du guide', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    await createVisualTemplate('u1', { ...TPL, slug: 'lie', styleGuideId: g.id });
    await createVisualTemplate('u1', { ...TPL, slug: 'libre', styleGuideId: null });
    const linked = await listVisualTemplatesByStyleGuide('u1', g.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.slug).toBe('lie');
  });

  test('supprimer le guide remet styleGuideId à null sans casser le template', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    const tpl = await createVisualTemplate('u1', { ...TPL, styleGuideId: g.id });
    await deleteStyleGuide('u1', g.id);
    const after = await getVisualTemplate('u1', tpl!.id);
    expect(after).toBeDefined();
    expect(after?.styleGuideId).toBeNull();
  });
});
