'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { WritingTemplateActionState } from '../writing-template-form';
import { createWritingTemplateCore } from './actions-core';

export async function createWritingTemplateAction(
  _prev: WritingTemplateActionState,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createWritingTemplateCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/writing-templates');
    redirect('/settings/writing-templates');
  }
  return result;
}
