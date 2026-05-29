'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { createStyle, deleteStyle, updateStyle } from '@/lib/media/styles';

export async function createStyleAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const prompt = (formData.get('prompt') as string | null)?.trim() ?? '';
  if (name && prompt) await createStyle(userId, { name, prompt });
  revalidatePath('/media/styles');
}

export async function updateStyleAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const prompt = (formData.get('prompt') as string | null)?.trim() ?? '';
  if (id) await updateStyle(userId, id, { name, prompt });
  revalidatePath('/media/styles');
}

export async function deleteStyleAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  if (id) await deleteStyle(userId, id);
  revalidatePath('/media/styles');
}
