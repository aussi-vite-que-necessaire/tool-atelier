'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import { renderTemplate } from '@/lib/media/templates/render';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  updateTemplate,
} from '@/lib/media/templates/repository';

export async function createTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';
  const label = (formData.get('label') as string | null)?.trim() ?? '';
  const width = Number.parseInt((formData.get('width') as string | null) ?? '1200', 10);
  const height = Number.parseInt((formData.get('height') as string | null) ?? '630', 10);
  const bodyHtml = (formData.get('body_html') as string | null) ?? '';

  if (!slug || !label) return;

  const created = await createTemplate(userId, {
    slug,
    label,
    width,
    height,
    bodyHtml,
    css: '',
    variablesSchema: [],
    sampleVars: {},
    platform: 'linkedin',
  });

  redirect(`/media/templates/${created.id}`);
}

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  if (!id) return;

  const variablesSchemaRaw = (formData.get('variables_schema') as string | null) ?? '[]';
  const sampleVarsRaw = (formData.get('sample_vars') as string | null) ?? '{}';

  let variablesSchema: unknown[];
  let sampleVars: Record<string, unknown>;
  try {
    variablesSchema = JSON.parse(variablesSchemaRaw) as unknown[];
  } catch {
    throw new Error('variables_schema : JSON invalide');
  }
  try {
    sampleVars = JSON.parse(sampleVarsRaw) as Record<string, unknown>;
  } catch {
    throw new Error('sample_vars : JSON invalide');
  }

  const styleGuideIdRaw = (formData.get('style_guide_id') as string | null) ?? '';

  await updateTemplate(userId, id, {
    slug: (formData.get('slug') as string | null)?.trim() ?? '',
    label: (formData.get('label') as string | null)?.trim() ?? '',
    platform: (formData.get('platform') as string | null)?.trim() ?? 'linkedin',
    width: Number.parseInt((formData.get('width') as string | null) ?? '1200', 10),
    height: Number.parseInt((formData.get('height') as string | null) ?? '630', 10),
    bodyHtml: (formData.get('body_html') as string | null) ?? '',
    css: (formData.get('css') as string | null) ?? '',
    variablesSchema,
    sampleVars,
    styleGuideId: styleGuideIdRaw || null,
  });

  revalidatePath(`/media/templates/${id}`);
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  if (id) await deleteTemplate(userId, id);
  revalidatePath('/media/templates');
}

export async function previewTemplateAction(
  _prev: { url?: string; error?: string },
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const userId = await requireUserId();
  const id = String(formData.get('id'));
  try {
    const t = await getTemplate(userId, id);
    if (!t) return { error: 'Template introuvable' };
    const rec = await renderTemplate(userId, id, (t.sampleVars ?? {}) as Record<string, unknown>, {
      imagesOptional: true,
    });
    revalidatePath('/media/gallery');
    return { url: rec.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Échec du rendu' };
  }
}
