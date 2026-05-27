import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import {
  deleteVisualTemplate,
  getVisualTemplate,
  updateVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { imageAssets } from '@/lib/db/schema';
import { validateTemplateForm } from '../validate-template-form';
import type { VisualTemplateActionState } from '../visual-template-form';

export async function updateVisualTemplateCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const existing = await getVisualTemplate(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const result = validateTemplateForm(formData);
  if (!result.ok) {
    return { status: 'error', message: result.message, fieldErrors: result.fieldErrors };
  }

  const updated = await updateVisualTemplate(userId, id, result.data);
  if (!updated) return { status: 'error', message: 'not-found' };
  return { status: 'success' };
}

export async function deleteVisualTemplateCore(
  userId: string,
  id: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string; refCount?: number }> {
  const existing = await getVisualTemplate(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const refs = await db
    .select({ slug: imageAssets.templateSlug })
    .from(imageAssets)
    .where(eq(imageAssets.templateSlug, existing.slug));
  if (refs.length > 0) {
    return {
      status: 'error',
      message: `${refs.length} visuel(s) référencent ce template. Détache-les avant de supprimer.`,
      refCount: refs.length,
    };
  }

  await deleteVisualTemplate(userId, id);
  return { status: 'success' };
}
