import { z } from 'zod';
import { createVoice } from '@/lib/db/repositories/voice';
import type { VoiceActionState } from '../voice-form';

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(8000),
});

export async function createVoiceCore(
  userId: string,
  formData: FormData,
): Promise<VoiceActionState> {
  const parsed = schema.safeParse({
    name: String(formData.get('name') ?? ''),
    content: String(formData.get('content') ?? ''),
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'validation' };
  }
  await createVoice(userId, parsed.data);
  return { status: 'success' };
}
