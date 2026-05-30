'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth/session';
import type { FormatActionState } from '../format-form';
import { deletePublicationFormatCore, updatePublicationFormatCore } from './actions-core';

export async function updatePublicationFormatAction(
  id: string,
  _prev: FormatActionState,
  formData: FormData,
): Promise<FormatActionState> {
  const userId = await getUserId();
  if (!userId) return { status: 'error', message: 'unauthenticated' };

  const result = await updatePublicationFormatCore(userId, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/cast/settings/formats/${id}`);
    revalidatePath('/cast/settings/formats');
  }
  return result;
}

export async function deletePublicationFormatActionRaw(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  await deletePublicationFormatCore(userId, id);
  revalidatePath('/cast/settings/formats');
  redirect('/cast/settings/formats');
}
