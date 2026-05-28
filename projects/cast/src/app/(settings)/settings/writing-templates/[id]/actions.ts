'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { WritingTemplateActionState } from '../writing-template-form';
import { deleteWritingTemplateCore, updateWritingTemplateCore } from './actions-core';

export async function updateWritingTemplateAction(
  id: string,
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateWritingTemplateCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/writing-templates/${id}`);
    revalidatePath('/settings/writing-templates');
  }
  return result;
}

export async function deleteWritingTemplateActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;

  await deleteWritingTemplateCore(session.user.id, id);
  revalidatePath('/settings/writing-templates');
  redirect('/settings/writing-templates');
}
