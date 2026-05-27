import { createVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { validateTemplateForm } from '../validate-template-form';
import type { VisualTemplateActionState } from '../visual-template-form';

export async function createVisualTemplateCore(
  userId: string,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const result = validateTemplateForm(formData);
  if (!result.ok) {
    return { status: 'error', message: result.message, fieldErrors: result.fieldErrors };
  }

  const created = await createVisualTemplate(userId, result.data);
  if (!created) {
    return {
      status: 'error',
      message: 'duplicate-slug',
      fieldErrors: { slug: 'Slug déjà utilisé.' },
    };
  }
  return { status: 'success' };
}
