import { z } from 'zod';
import {
  deleteWritingTemplate,
  getWritingTemplate,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import type { WritingTemplateActionState } from '../writing-template-form';

const updateSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  writingRules: z.string().max(5000),
});

export async function updateWritingTemplateCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<WritingTemplateActionState> {
  const existing = await getWritingTemplate(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }

  const raw = {
    name: String(formData.get('name') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    writingRules: String(formData.get('writingRules') ?? ''),
  };

  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateWritingTemplate(userId, id, {
    name: parsed.data.name,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  return { status: 'success' };
}

export async function deleteWritingTemplateCore(
  userId: string,
  id: string,
): Promise<WritingTemplateActionState> {
  const existing = await getWritingTemplate(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }
  await deleteWritingTemplate(userId, id);
  return { status: 'success' };
}
