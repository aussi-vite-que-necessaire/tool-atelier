'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { VisualStyleActionState } from '../visual-style-form';
import { createVisualStyleCore } from './actions-core';

export async function createVisualStyleAction(
  _prev: VisualStyleActionState,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createVisualStyleCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-styles');
    redirect('/settings/visual-styles');
  }
  return result;
}
