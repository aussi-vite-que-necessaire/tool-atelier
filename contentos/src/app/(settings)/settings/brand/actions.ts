'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { type BrandActionState, updateBrandSettingsCore } from './actions-core';

export async function updateBrandSettings(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { status: 'error', message: 'unauthenticated' };
  }
  const result = await updateBrandSettingsCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/brand');
  }
  return result;
}
