import { getTemplate } from "./repository";
import { compileTemplate } from "./compile";
import { fillVarDefaults, parseVariablesSchema, variablesSchemaToZod } from "./dsl";
import { getBrandContext } from "@/lib/brand/repository";
import { renderHtml } from "@/lib/render";
import { store } from "@/lib/store";
import type { MediaRecord } from "@/lib/media/types";

// Compile un template + variables + marque → HTML → image (via browserless) → store.
export async function renderTemplate(
  templateId: string,
  vars: Record<string, unknown>,
  opts: { imagesOptional?: boolean } = {},
): Promise<MediaRecord> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error(`Template introuvable: ${templateId}`);

  const schema = parseVariablesSchema(template.variablesSchema);
  const validated = variablesSchemaToZod(schema, opts).parse(vars) as Record<string, unknown>;
  const filled = fillVarDefaults(schema, validated);
  const brand = await getBrandContext();

  const html = compileTemplate({ template, vars: filled, brand });
  const { bytes, mimeType } = await renderHtml({ html, width: template.width, height: template.height });
  return store({
    bytes,
    mimeType,
    kind: "render",
    prompt: null,
    parent_id: null,
    source: "template_render",
    tags: [],
    width: template.width,
    height: template.height,
    template_id: template.id,
    vars: filled,
  });
}
