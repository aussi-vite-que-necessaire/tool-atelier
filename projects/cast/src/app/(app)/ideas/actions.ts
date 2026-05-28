'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { type ActionState, createIdeaCore, deleteIdeaCore, updateIdeaCore } from './actions-core';

export async function createIdeaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await createIdeaCore(userId, formData);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}

export async function updateIdeaAction(input: {
  id: string;
  idea?: string;
  brief?: string | null;
}): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await updateIdeaCore(userId, input);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}

export async function deleteIdeaAction(id: string): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await deleteIdeaCore(userId, id);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}
