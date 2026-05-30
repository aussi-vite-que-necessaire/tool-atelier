import { getBrandContext } from '../brand';
import { renderHtml } from '../render';
import { store } from '../store';
import type { MediaRecord } from '../types';
import { compileTemplate } from './compile';
import { fillVarDefaults, parseVariablesSchema, variablesSchemaToZod } from './dsl';
import { getTemplate } from './repository';

// Compile un template + variables + marque → HTML → image (via browserless) → store.
export async function renderTemplate(
  userId: string,
  templateId: string,
  vars: Record<string, unknown>,
  opts: { imagesOptional?: boolean } = {},
): Promise<MediaRecord> {
  const template = await getTemplate(userId, templateId);
  if (!template) throw new Error(`Template introuvable: ${templateId}`);

  const schema = parseVariablesSchema(template.variablesSchema);
  const validated = variablesSchemaToZod(schema, opts).parse(vars) as Record<string, unknown>;
  const filled = fillVarDefaults(schema, validated);
  const brand = await getBrandContext(userId);

  const html = compileTemplate({ template, vars: filled, brand });
  const { bytes, mimeType } = await renderHtml({
    html,
    width: template.width,
    height: template.height,
  });
  return store({
    userId,
    bytes,
    mimeType,
    // Un rendu de template est une image ; sa provenance vit dans `source`.
    kind: 'image',
    prompt: null,
    parent_id: null,
    source: 'template_render',
    tags: [],
    width: template.width,
    height: template.height,
    template_id: template.id,
    vars: filled,
  });
}
