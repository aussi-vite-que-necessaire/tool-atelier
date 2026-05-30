'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth/session';
import type { FormatActionState } from '../format-form';
import { createPublicationFormatCore } from './actions-core';

export async function createPublicationFormatAction(
  _prev: FormatActionState,
  formData: FormData,
): Promise<FormatActionState> {
  const userId = await getUserId();
  if (!userId) return { status: 'error', message: 'unauthenticated' };

  const result = await createPublicationFormatCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/cast/settings/formats');
    redirect('/cast/settings/formats');
  }
  return result;
}
