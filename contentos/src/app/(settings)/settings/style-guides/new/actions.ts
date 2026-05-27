'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { StyleGuideActionState } from '../style-guide-form';
import { createStyleGuideCore } from './actions-core';

export async function createStyleGuideAction(
  _prev: StyleGuideActionState,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createStyleGuideCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/style-guides');
    redirect('/settings/style-guides');
  }
  return result;
}
