import { describe, expect, test } from 'vitest';
import type { VisualTemplate } from '@/lib/db/schema';
import { compileTemplate } from '@/lib/visual-templates/compile';

function makeTemplate(overrides: Partial<VisualTemplate> = {}): VisualTemplate {
  return {
    id: 't1',
    userId: 'u1',
    slug: 'test',
    label: 'Test',
    platform: 'linkedin',
    width: 1080,
    height: 1080,
    bodyHtml: '<h1>{{title}}</h1>',
    css: 'h1 { color: red; }',
    variablesSchema: [],
    sampleVars: {},
    styleGuideId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const BRAND = {
  name: 'Acme',
  signature: 'ACME.IO',
  logo: 'https://cdn.example/logo.png',
};

describe('compileTemplate', () => {
  test('interpole une variable string', () => {
    const out = compileTemplate({
      template: makeTemplate(),
      vars: { title: 'Hello' },
      brand: BRAND,
    });
    expect(out).toContain('<h1>Hello</h1>');
  });

  test('échappe le HTML dans les inputs user (double-stash)', () => {
    const out = compileTemplate({
      template: makeTemplate(),
      vars: { title: '<script>x</script>' },
      brand: BRAND,
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>x</script>');
  });

  test('expose le contexte brand', () => {
    const out = compileTemplate({
      template: makeTemplate({ bodyHtml: '<div>{{brand.name}}/{{brand.signature}}</div>' }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('<div>Acme/ACME.IO</div>');
  });

  test('substitue le logo de marque dans un attribut src', () => {
    const out = compileTemplate({
      template: makeTemplate({ bodyHtml: '<img src="{{brand.logo}}">' }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('<img src="https://cdn.example/logo.png">');
  });

  test('interpole aussi dans le CSS', () => {
    const out = compileTemplate({
      template: makeTemplate({
        bodyHtml: '<div></div>',
        css: 'body::after { content: "{{brand.name}}"; }',
      }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('content: "Acme"');
  });

  test('embed la base CSS + width/height dans le body', () => {
    const out = compileTemplate({
      template: makeTemplate({ bodyHtml: '<div></div>', width: 800, height: 600 }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('@font-face');
    expect(out).toContain('width:800px');
    expect(out).toContain('height:600px');
  });

  test('throw sur variable manquante en strict mode', () => {
    expect(() =>
      compileTemplate({
        template: makeTemplate({ bodyHtml: '<p>{{missing}}</p>' }),
        vars: {},
        brand: BRAND,
      }),
    ).toThrow();
  });

  test('helper ifNotEmpty : skip vide / render non-vide', () => {
    const t = makeTemplate({
      bodyHtml: '{{#ifNotEmpty subtitle}}<p>{{subtitle}}</p>{{/ifNotEmpty}}',
    });
    const a = compileTemplate({ template: t, vars: { subtitle: '' }, brand: BRAND });
    const b = compileTemplate({ template: t, vars: { subtitle: 'X' }, brand: BRAND });
    expect(a).not.toContain('<p>');
    expect(b).toContain('<p>X</p>');
  });

  test('helper trim', () => {
    const out = compileTemplate({
      template: makeTemplate({ bodyHtml: '<p>{{trim title}}</p>' }),
      vars: { title: '  hello  ' },
      brand: BRAND,
    });
    expect(out).toContain('<p>hello</p>');
  });
});
