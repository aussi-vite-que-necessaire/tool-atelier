import { z } from 'zod';
import {
  deletePublicationFormat,
  getPublicationFormat,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';
import type { FormatActionState } from '../format-form';

const updateSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['linkedin']),
  structure: z.string().min(1).max(5000),
  visualIntent: z.string().max(2000),
  writingRules: z.string().max(5000),
});

export async function updatePublicationFormatCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<FormatActionState> {
  const existing = await getPublicationFormat(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }

  const raw = {
    name: String(formData.get('name') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    structure: String(formData.get('structure') ?? ''),
    visualIntent: String(formData.get('visualIntent') ?? ''),
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

  await updatePublicationFormat(userId, id, {
    name: parsed.data.name,
    platform: parsed.data.platform,
    structure: parsed.data.structure,
    visualIntent: parsed.data.visualIntent === '' ? null : parsed.data.visualIntent,
    writingRules: parsed.data.writingRules === '' ? null : parsed.data.writingRules,
  });

  return { status: 'success' };
}

export async function deletePublicationFormatCore(
  userId: string,
  id: string,
): Promise<FormatActionState> {
  const existing = await getPublicationFormat(userId, id);
  if (!existing) {
    return { status: 'error', message: 'not-found' };
  }
  await deletePublicationFormat(userId, id);
  return { status: 'success' };
}
