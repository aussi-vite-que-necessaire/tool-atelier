'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import type { VoiceActionState } from '../voice-form';
import { createVoiceCore } from './actions-core';

export async function createVoiceAction(
  _prev: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const userId = await requireUserId();
  const result = await createVoiceCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/voice');
    redirect('/settings/voice');
  }
  return result;
}
