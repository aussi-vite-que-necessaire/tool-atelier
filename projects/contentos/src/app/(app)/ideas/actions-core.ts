import { z } from 'zod';
import { createIdea, deleteIdea, updateIdea } from '@/lib/db/repositories/ideas';

export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string };

const CreateSchema = z.object({
  idea: z.string().trim().min(1, 'Titre requis').max(500),
  brief: z.string().trim().max(20000).optional(),
});

export async function createIdeaCore(userId: string, formData: FormData): Promise<ActionState> {
  const parsed = CreateSchema.safeParse({
    idea: formData.get('idea'),
    brief: formData.get('brief') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  await createIdea(userId, parsed.data);
  return { status: 'success' };
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  idea: z.string().trim().min(1).max(500).optional(),
  brief: z
    .string()
    .trim()
    .max(20000)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

export async function updateIdeaCore(
  userId: string,
  input: { id: string; idea?: string; brief?: string | null },
): Promise<ActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const { id, ...patch } = parsed.data;
  const updated = await updateIdea(userId, id, patch);
  if (!updated) return { status: 'error', message: 'Idée introuvable' };
  return { status: 'success' };
}

export async function deleteIdeaCore(userId: string, id: string): Promise<ActionState> {
  await deleteIdea(userId, id);
  return { status: 'success' };
}
