import { describe, expect, test } from 'vitest';
import { compileTemplate } from '@/lib/visual-templates/compile';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';
import { VISUAL_TEMPLATE_SEEDS } from '@/lib/visual-templates/seeds';

const BRAND = { name: 'Acme', color: '#000', signature: 'ACME', logo: '' };

describe('seeds visual-templates', () => {
  test.each(
    VISUAL_TEMPLATE_SEEDS,
  )('le seed "$slug" est cohérent (schéma + sample + compile)', (seed) => {
    // 1. variablesSchema doit parser via le DSL.
    const schema = parseVariablesSchema(seed.variablesSchema);
    expect(schema.length).toBeGreaterThan(0);

    // 2. sampleVars doit respecter le schéma (images optionnelles en sample,
    //    comme la preview back-office).
    const validated = variablesSchemaToZod(schema, { imagesOptional: true }).parse(
      seed.sampleVars,
    ) as Record<string, unknown>;

    // Comme le worker, les vars image absentes sont définies (chaîne vide)
    // pour que le compile Handlebars strict ne throw pas.
    const vars: Record<string, unknown> = { ...validated };
    for (const spec of schema) {
      if (spec.type === 'image' && vars[spec.name] === undefined) vars[spec.name] = '';
    }

    // 3. Le template doit compiler sans erreur.
    const html = compileTemplate({
      template: {
        id: 'seed-test',
        userId: 'u',
        slug: seed.slug,
        label: seed.label,
        platform: seed.platform,
        width: seed.width,
        height: seed.height,
        bodyHtml: seed.bodyHtml,
        css: seed.css,
        variablesSchema: schema,
        sampleVars: seed.sampleVars,
        styleGuideId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      vars,
      brand: BRAND,
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain(`width:${seed.width}px`);
    expect(html).toContain(`height:${seed.height}px`);
  });
});
