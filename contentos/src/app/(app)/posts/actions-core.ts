import { z } from 'zod';
import { createPost, deletePost, updatePost } from '@/lib/db/repositories/posts';
import type { ActionState } from '../ideas/actions-core';

export type CreatePostState =
  | { status: 'success'; postId: string }
  | { status: 'error'; message: string };

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis').max(200),
});

export async function createPostCore(
  userId: string,
  input: { title: string },
): Promise<CreatePostState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const post = await createPost(userId, { title: parsed.data.title, content: '' });
  return { status: 'success', postId: post.id };
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['draft', 'validated']).optional(),
});

export async function updatePostCore(
  userId: string,
  input: { id: string; title?: string; content?: string; status?: 'draft' | 'validated' },
): Promise<ActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return { status: 'error', message: 'Aucun champ à mettre à jour' };
  }
  const updated = await updatePost(userId, id, patch);
  if (!updated) return { status: 'error', message: 'Post introuvable' };
  return { status: 'success' };
}

export async function deletePostCore(userId: string, id: string): Promise<ActionState> {
  await deletePost(userId, id);
  return { status: 'success' };
}
