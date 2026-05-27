'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import type { VisualTemplateActionState } from '../visual-template-form';
import { createVisualTemplateCore } from './actions-core';

export async function createVisualTemplateAction(
  _prev: VisualTemplateActionState,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const userId = await requireUserId();
  const result = await createVisualTemplateCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-templates');
    redirect('/settings/visual-templates');
  }
  return result;
}
