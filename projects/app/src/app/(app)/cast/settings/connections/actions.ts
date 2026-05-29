'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { deleteSocialAccount } from '@/lib/db/repositories/social-accounts';

export async function disconnectLinkedInAction(): Promise<{ status: 'success' }> {
  const userId = await requireUserId();
  await deleteSocialAccount(userId, 'linkedin');
  revalidatePath('/cast/settings/connections');
  return { status: 'success' };
}
