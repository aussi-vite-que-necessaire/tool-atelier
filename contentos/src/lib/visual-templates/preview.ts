import type { VisualTemplate } from '@/lib/db/schema';
import { type Brand, EMPTY_BRAND } from './brand';
import { compileTemplate } from './compile';
import { fillVarDefaults, parseVariablesSchema } from './dsl';

// Placeholder gris pour les variables image en preview (pas de mediaId résolu).
const IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e5e5"/></svg>',
)}`;

// Compile un template visuel en HTML complet (sans rendu image / Puppeteer).
// Les variables image prennent un placeholder ; les défauts de schéma sont
// remplis pour satisfaire le strict mode Handlebars.
export function buildPreviewHtml(
  template: VisualTemplate,
  vars: Record<string, unknown>,
  brand: Brand = EMPTY_BRAND,
): string {
  const schema = parseVariablesSchema(template.variablesSchema);
  const context = fillVarDefaults(schema, vars);
  for (const spec of schema) {
    if (spec.type === 'image' && !context[spec.name]) {
      context[spec.name] = IMAGE_PLACEHOLDER;
    }
  }
  return compileTemplate({ template, vars: context, brand });
}
