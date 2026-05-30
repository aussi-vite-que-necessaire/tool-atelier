import { z } from 'zod';
import { createWritingTemplate } from '@/lib/db/repositories/writing-templates';
import type { WritingTemplateActionState } from '../writing-template-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  writingRules: z.string().max(5000),
});

export async function createWritingTemplateCore(
  userId: string,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    writingRules: String(formData.get('writingRules') ?? ''),
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

  await createWritingTemplate(userId, {
    name: parsed.data.name,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  return { status: 'success' };
}
