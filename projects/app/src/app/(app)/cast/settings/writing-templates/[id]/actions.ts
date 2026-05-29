'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth/session';
import type { WritingTemplateActionState } from '../writing-template-form';
import { deleteWritingTemplateCore, updateWritingTemplateCore } from './actions-core';

export async function updateWritingTemplateAction(
  id: string,
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const userId = await getUserId();
  if (!userId) return { status: 'error', message: 'unauthenticated' };

  const result = await updateWritingTemplateCore(userId, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/cast/settings/writing-templates/${id}`);
    revalidatePath('/cast/settings/writing-templates');
  }
  return result;
}

export async function deleteWritingTemplateActionRaw(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await deleteWritingTemplateCore(userId, id);
  revalidatePath('/cast/settings/writing-templates');
  redirect('/cast/settings/writing-templates');
}
