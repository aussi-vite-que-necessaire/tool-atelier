import { z } from 'zod';
import {
  deleteVisualStyle,
  getVisualStyle,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import type { VisualStyleActionState } from '../visual-style-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
});

export async function updateVisualStyleCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<VisualStyleActionState> {
  const existing = await getVisualStyle(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const raw = {
    name: String(formData.get('name') ?? ''),
    prompt: String(formData.get('prompt') ?? ''),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateVisualStyle(userId, id, parsed.data);
  return { status: 'success' };
}

export async function deleteVisualStyleCore(
  userId: string,
  id: string,
): Promise<VisualStyleActionState> {
  const existing = await getVisualStyle(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };
  await deleteVisualStyle(userId, id);
  return { status: 'success' };
}
