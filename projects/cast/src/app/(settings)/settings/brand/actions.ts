'use server';

import { revalidatePath } from 'next/cache';
import { getUserId } from '@/lib/auth/session';
import { type BrandActionState, updateBrandSettingsCore } from './actions-core';

export async function updateBrandSettings(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  const userId = await getUserId();
  if (!userId) {
    return { status: 'error', message: 'unauthenticated' };
  }
  const result = await updateBrandSettingsCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/brand');
  }
  return result;
}
