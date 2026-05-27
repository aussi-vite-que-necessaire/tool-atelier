'use server';

import { randomUUID } from 'node:crypto';
import { requireUserId } from '@/lib/auth/session';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { enqueueRenderVisual } from '@/lib/queue/enqueue';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

export async function enqueuePreviewAction(input: {
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, input.templateId);
  if (!t) return { status: 'error', message: 'Template introuvable' };

  try {
    const schema = parseVariablesSchema(t.variablesSchema);
    // Preview : images optionnelles (placeholder injecté au rendu).
    variablesSchemaToZod(schema, { imagesOptional: true }).parse(input.vars);
  } catch (e) {
    return { status: 'error', message: `Vars invalides : ${(e as Error).message}` };
  }

  const jobKey = randomUUID();
  await enqueueRenderVisual({
    userId,
    templateId: t.id,
    vars: input.vars,
    mode: 'preview',
    jobKey,
  });
  return { status: 'success', jobKey };
}
