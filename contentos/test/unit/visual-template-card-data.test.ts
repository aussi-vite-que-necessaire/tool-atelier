import { describe, expect, test } from 'vitest';
import { toTemplateCardData } from '@/app/(settings)/settings/visual-templates/_components/template-card-data';
import type { VisualTemplate } from '@/lib/db/schema';

// Fixture minimale imitant le style de visual-preview.test.ts
function makeTemplate(over: Partial<VisualTemplate> = {}): VisualTemplate {
  return {
    id: 'tmpl-1',
    userId: 'u1',
    slug: 'bonjour-slug',
    label: 'Bonjour Label',
    platform: 'linkedin',
    width: 1080,
    height: 1350,
    bodyHtml: '<h1>{{title}}</h1>',
    css: '',
    variablesSchema: [{ name: 'title', label: 'Titre', type: 'string', max: 50 }],
    sampleVars: { title: 'Bonjour' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as VisualTemplate;
}

const brand = { name: 'TestBrand', color: '#ff0000', signature: null, logo: '' };

describe('toTemplateCardData', () => {
  test('retourne un item par template avec les champs attendus', () => {
    const t = makeTemplate();
    const result = toTemplateCardData([t], brand);

    expect(result).toHaveLength(1);
    const card = result[0]!;

    expect(card.id).toBe('tmpl-1');
    expect(card.label).toBe('Bonjour Label');
    expect(card.platform).toBe('linkedin');
    expect(card.slug).toBe('bonjour-slug');
    expect(card.width).toBe(1080);
    expect(card.height).toBe(1350);
  });

  test('html est une chaîne non vide contenant les sampleVars rendus', () => {
    const t = makeTemplate();
    const result = toTemplateCardData([t], brand);
    const card = result[0]!;

    expect(typeof card.html).toBe('string');
    expect(card.html.length).toBeGreaterThan(0);
    // sampleVars { title: 'Bonjour' } doit apparaître dans le HTML compilé
    expect(card.html).toContain('Bonjour');
  });

  test('retourne un tableau vide pour une liste vide', () => {
    expect(toTemplateCardData([], brand)).toEqual([]);
  });

  test('mappe correctement plusieurs templates', () => {
    const t1 = makeTemplate({ id: 'a', slug: 'slug-a', label: 'A' });
    const t2 = makeTemplate({ id: 'b', slug: 'slug-b', label: 'B' });
    const result = toTemplateCardData([t1, t2], brand);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });
});
