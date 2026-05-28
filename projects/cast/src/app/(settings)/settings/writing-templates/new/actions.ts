'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth/session';
import type { WritingTemplateActionState } from '../writing-template-form';
import { createWritingTemplateCore } from './actions-core';

export async function createWritingTemplateAction(
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const userId = await getUserId();
  if (!userId) return { status: 'error', message: 'unauthenticated' };

  const result = await createWritingTemplateCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/writing-templates');
    redirect('/settings/writing-templates');
  }
  return result;
}
