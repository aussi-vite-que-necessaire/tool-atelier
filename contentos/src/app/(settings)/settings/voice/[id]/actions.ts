'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import { deleteVoice } from '@/lib/db/repositories/voice';
import type { VoiceActionState } from '../voice-form';
import { updateVoiceCore } from './actions-core';

export async function updateVoiceAction(
  id: string,
  _prev: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const userId = await requireUserId();
  const result = await updateVoiceCore(userId, id, formData);
  if (result.status === 'success') revalidatePath(`/settings/voice/${id}`);
  return result;
}

export async function deleteVoiceAction(id: string): Promise<void> {
  const userId = await requireUserId();
  await deleteVoice(userId, id);
  redirect('/settings/voice');
}
