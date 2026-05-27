import { describe, expect, test } from 'vitest';
import type { VisualTemplate } from '@/lib/db/schema';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';

function template(over: Partial<VisualTemplate> = {}): VisualTemplate {
  return {
    id: 't1',
    userId: 'u',
    slug: 'demo',
    label: 'Demo',
    platform: 'linkedin',
    width: 1080,
    height: 1350,
    bodyHtml: `<h1 class="t">{{titre}}</h1>
<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>
<img src="{{photo}}" alt="">`,
    css: `.t { color: {{accent}}; }`,
    variablesSchema: [
      { name: 'titre', label: 'Titre', type: 'string', max: 50 },
      { name: 'items', label: 'Items', type: 'list' },
      { name: 'accent', label: 'Accent', type: 'color', default: '#ff0000' },
      { name: 'photo', label: 'Photo', type: 'image' },
    ],
    sampleVars: { titre: 'Bonjour', items: ['un', 'deux'] },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as VisualTemplate;
}

describe('buildPreviewHtml', () => {
  test('compile les 4 types avec sampleVars + défauts', () => {
    const html = buildPreviewHtml(template(), { titre: 'Bonjour', items: ['un', 'deux'] });
    expect(html).toContain('Bonjour');
    expect(html).toContain('<li>un</li>');
    expect(html).toContain('<li>deux</li>');
    // color default injecté dans le CSS
    expect(html).toContain('color: #ff0000');
    // image var → placeholder (data URI)
    expect(html).toContain('data:image/svg+xml');
  });

  test('compile sans throw même si tout est absent (fillVarDefaults)', () => {
    expect(() => buildPreviewHtml(template(), {})).not.toThrow();
  });
});
