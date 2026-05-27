'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import type { VisualTemplateActionState } from '../visual-template-form';
import { deleteVisualTemplateCore, updateVisualTemplateCore } from './actions-core';

export async function updateVisualTemplateAction(
  id: string,
  _prev: VisualTemplateActionState,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const userId = await requireUserId();
  const result = await updateVisualTemplateCore(userId, id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-templates');
    revalidatePath(`/settings/visual-templates/${id}`);
  }
  return result;
}

export async function deleteVisualTemplateAction(id: string): Promise<void> {
  const userId = await requireUserId();
  const result = await deleteVisualTemplateCore(userId, id);
  if (result.status === 'error') throw new Error(result.message);
  revalidatePath('/settings/visual-templates');
  redirect('/settings/visual-templates');
}
