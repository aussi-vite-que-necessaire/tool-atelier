'use server';

import { revalidatePath } from 'next/cache';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';
import { requireUserId } from '@/lib/auth/session';
import { deleteSocialAccount } from '@/lib/db/repositories/social-accounts';

export async function disconnectLinkedInAction(): Promise<{ status: 'success' }> {
  const userId = await requireUserId();
  await deleteSocialAccount(userId, 'linkedin');
  revalidatePath(ACCOUNT_CONNECTIONS_PATH);
  return { status: 'success' };
}
