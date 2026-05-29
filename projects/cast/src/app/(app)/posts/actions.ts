'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import type { ActionState } from './actions-core';
import {
  type CreatePostState,
  createPostCore,
  deletePostCore,
  updatePostCore,
} from './actions-core';

export async function createPostAction(input: { title: string }): Promise<CreatePostState> {
  const userId = await requireUserId();
  const result = await createPostCore(userId, input);
  if (result.status === 'success') revalidatePath('/posts');
  return result;
}

export async function updatePostAction(input: {
  id: string;
  title?: string;
  content?: string;
  status?: 'draft' | 'validated';
}): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await updatePostCore(userId, input);
  if (result.status === 'success') {
    revalidatePath('/posts');
    revalidatePath(`/posts/${input.id}`);
  }
  return result;
}

export async function deletePostAction(id: string): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await deletePostCore(userId, id);
  if (result.status === 'success') revalidatePath('/posts');
  return result;
}
