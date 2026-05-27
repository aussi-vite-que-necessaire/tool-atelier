import { z } from 'zod';
import { createVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { VisualStyleActionState } from '../visual-style-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(2000),
});

export async function createVisualStyleCore(
  userId: string,
  formData: FormData,
): Promise<VisualStyleActionState> {
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

  await createVisualStyle(userId, parsed.data);
  return { status: 'success' };
}
