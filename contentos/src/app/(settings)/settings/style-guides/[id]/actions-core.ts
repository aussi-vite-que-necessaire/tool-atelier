import { z } from 'zod';
import {
  deleteStyleGuide,
  getStyleGuide,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import type { StyleGuideActionState } from '../style-guide-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(50000),
});

export async function updateStyleGuideCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const existing = await getStyleGuide(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const raw = {
    name: String(formData.get('name') ?? ''),
    content: String(formData.get('content') ?? ''),
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

  await updateStyleGuide(userId, id, parsed.data);
  return { status: 'success' };
}

export async function deleteStyleGuideCore(
  userId: string,
  id: string,
): Promise<StyleGuideActionState> {
  const existing = await getStyleGuide(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };
  await deleteStyleGuide(userId, id);
  return { status: 'success' };
}
