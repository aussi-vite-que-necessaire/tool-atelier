import { z } from 'zod';
import { createPublicationFormat } from '@/lib/db/repositories/publication-formats';
import type { FormatActionState } from '../format-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  visualIntent: z.string().max(2000),
  writingRules: z.string().max(5000),
});

export async function createPublicationFormatCore(
  userId: string,
  formData: FormData,
): Promise<FormatActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    visualIntent: String(formData.get('visualIntent') ?? ''),
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

  await createPublicationFormat(userId, {
    name: parsed.data.name,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    visualIntent: parsed.data.visualIntent === '' ? null : parsed.data.visualIntent,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  return { status: 'success' };
}
