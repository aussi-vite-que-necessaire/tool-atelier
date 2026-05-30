import { describe, expect, it } from 'vitest';
import { EMPTY_BRAND } from '@/lib/media/brand';
import { compileTemplate } from '@/lib/media/templates/compile';

function tpl(over: Partial<{ bodyHtml: string; css: string; width: number; height: number }> = {}) {
  return {
    id: 't1',
    userId: 'u1',
    slug: 's',
    label: 'L',
    platform: 'linkedin',
    // Espace avant `}` final : sinon Handlebars lit `{{accent}}}` comme un triple-stache.
    width: 1200,
    height: 627,
    bodyHtml: '<h1>{{escape titre}}</h1>',
    css: 'h1{ color:{{accent}} }',
    variablesSchema: [],
    sampleVars: {},
    styleGuideId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Parameters<typeof compileTemplate>[0]['template'];
}

describe('compileTemplate', () => {
  it('injecte les variables et la marque', () => {
    const html = compileTemplate({
      template: tpl(),
      vars: { titre: 'Bonjour', accent: '#123456' },
      brand: EMPTY_BRAND,
    });
    expect(html).toContain('<h1>Bonjour</h1>');
    expect(html).toContain('color:#123456');
    expect(html).toContain('style="width:1200px;height:627px"');
  });
  it('expose brand dans le contexte', () => {
    const html = compileTemplate({
      template: tpl({ bodyHtml: '<p>{{brand.name}}</p>', css: '' }),
      vars: {},
      brand: { name: 'AVQN', signature: null, logo: '' },
    });
    expect(html).toContain('<p>AVQN</p>');
  });
});
