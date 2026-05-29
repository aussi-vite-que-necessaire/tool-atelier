'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { upsertBrand } from '@/lib/media/brand';

export async function saveBrandAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const signature = (formData.get('signature') as string | null)?.trim() ?? '';
  const logoUrl = (formData.get('logoUrl') as string | null)?.trim() || null;
  await upsertBrand(userId, { name, signature, logoUrl });
  revalidatePath('/media/brand');
}
