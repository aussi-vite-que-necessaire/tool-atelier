'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { StyleGuideActionState } from '../style-guide-form';
import { deleteStyleGuideCore, updateStyleGuideCore } from './actions-core';

export async function updateStyleGuideAction(
  id: string,
  _prev: StyleGuideActionState,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateStyleGuideCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/style-guides/${id}`);
    revalidatePath('/settings/style-guides');
  }
  return result;
}

export async function deleteStyleGuideActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await deleteStyleGuideCore(session.user.id, id);
  revalidatePath('/settings/style-guides');
  redirect('/settings/style-guides');
}
