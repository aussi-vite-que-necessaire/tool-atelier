import { z } from 'zod';
import { createStyleGuide } from '@/lib/db/repositories/style-guides';
import type { StyleGuideActionState } from '../style-guide-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(50000),
});

export async function createStyleGuideCore(
  userId: string,
  formData: FormData,
): Promise<StyleGuideActionState> {
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

  await createStyleGuide(userId, parsed.data);
  return { status: 'success' };
}
