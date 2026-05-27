import { describe, expect, test } from 'vitest';
import type { VisualTemplate } from '@/lib/db/schema';
import { parseVariablesSchema } from '@/lib/visual-templates/dsl';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';
import { VISUAL_TEMPLATE_SEEDS } from '@/lib/visual-templates/seeds';

function asTemplate(seed: (typeof VISUAL_TEMPLATE_SEEDS)[number]): VisualTemplate {
  return {
    id: seed.slug,
    userId: 'u',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...seed,
  } as VisualTemplate;
}

describe('VISUAL_TEMPLATE_SEEDS', () => {
  test('12 templates seedés, slugs uniques', () => {
    const slugs = VISUAL_TEMPLATE_SEEDS.map((s) => s.slug);
    expect(slugs.length).toBe(12);
    expect(new Set(slugs).size).toBe(12);
  });

  for (const seed of VISUAL_TEMPLATE_SEEDS) {
    describe(seed.slug, () => {
      test('schéma de variables valide', () => {
        expect(() => parseVariablesSchema(seed.variablesSchema)).not.toThrow();
      });

      test('compile (Handlebars strict) avec sampleVars → HTML non vide', () => {
        const html = buildPreviewHtml(asTemplate(seed), seed.sampleVars as Record<string, unknown>);
        expect(html).toContain('<!doctype html>');
        expect(html.length).toBeGreaterThan(200);
      });

      test('compile aussi avec vars vides (fillVarDefaults)', () => {
        expect(() => buildPreviewHtml(asTemplate(seed), {})).not.toThrow();
      });
    });
  }
});
