'use server';

import { requireUserId } from '@/lib/auth/session';
import type { VisualTemplate } from '@/lib/db/schema';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';

// Compile l'aperçu HTML d'un template en cours d'édition (valeurs du formulaire,
// pas encore enregistrées) : aperçu live dans l'éditeur, sans Puppeteer.
export async function compileTemplateDraftAction(input: {
  bodyHtml: string;
  css: string;
  width: number;
  height: number;
  variablesSchema: VariableSpec[];
  sampleVars: Record<string, unknown>;
}): Promise<{ status: 'success'; html: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const brand = await buildBrandContext(userId);

  const now = new Date();
  const transient = {
    id: 'draft',
    userId,
    label: 'draft',
    slug: 'draft',
    platform: 'linkedin',
    width: input.width,
    height: input.height,
    bodyHtml: input.bodyHtml,
    css: input.css,
    variablesSchema: input.variablesSchema,
    sampleVars: input.sampleVars,
    createdAt: now,
    updatedAt: now,
  } as unknown as VisualTemplate;

  try {
    return { status: 'success', html: buildPreviewHtml(transient, input.sampleVars, brand) };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}
