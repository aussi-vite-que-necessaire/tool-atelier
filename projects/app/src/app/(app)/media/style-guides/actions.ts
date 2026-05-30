'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { createGuide, deleteGuide, updateGuide } from '@/lib/media/style-guides';

export async function createGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null) ?? '';
  if (name) await createGuide(userId, { name, content });
  revalidatePath('/media/style-guides');
}

export async function updateGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null) ?? '';
  if (id) await updateGuide(userId, id, { name, content });
  revalidatePath('/media/style-guides');
}

export async function deleteGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  if (id) await deleteGuide(userId, id);
  revalidatePath('/media/style-guides');
}
