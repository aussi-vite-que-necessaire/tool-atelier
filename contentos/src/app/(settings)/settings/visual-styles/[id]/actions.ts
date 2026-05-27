'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { VisualStyleActionState } from '../visual-style-form';
import { deleteVisualStyleCore, updateVisualStyleCore } from './actions-core';

export async function updateVisualStyleAction(
  id: string,
  _prev: VisualStyleActionState,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateVisualStyleCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/visual-styles/${id}`);
    revalidatePath('/settings/visual-styles');
  }
  return result;
}

export async function deleteVisualStyleActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await deleteVisualStyleCore(session.user.id, id);
  revalidatePath('/settings/visual-styles');
  redirect('/settings/visual-styles');
}
