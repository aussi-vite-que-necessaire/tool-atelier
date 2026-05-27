'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { IMAGE_ASPECT_RATIOS } from '@/lib/media/aspect-ratios';
import { uploadImageCore } from '@/lib/media/upload-core';
import { enqueueGenerateImage } from '@/lib/queue/enqueue';
import { deleteImageCore } from './actions-core';
import { editImageGuard } from './edit-image-core';

export async function uploadImageAction(
  formData: FormData,
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const file = formData.get('file');
  if (!(file instanceof File)) return { status: 'error', message: 'Fichier manquant.' };
  const rawPostId = formData.get('postId');
  const postId = typeof rawPostId === 'string' && rawPostId.length > 0 ? rawPostId : undefined;

  const result = await uploadImageCore(userId, file, { postId });
  if (result.status === 'success') {
    revalidatePath('/media');
    if (postId) revalidatePath(`/posts/${postId}`);
  }
  return result;
}

export async function enqueueGenerateImageAction(input: {
  prompt: string;
  aspectRatio: string;
  styleId?: string;
  postId?: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  if (!input.prompt.trim()) return { status: 'error', message: 'Prompt requis' };
  if (!IMAGE_ASPECT_RATIOS.includes(input.aspectRatio as (typeof IMAGE_ASPECT_RATIOS)[number])) {
    return { status: 'error', message: 'Format invalide' };
  }
  const jobKey = randomUUID();
  await enqueueGenerateImage({
    userId,
    prompt: input.prompt.trim(),
    aspectRatio: input.aspectRatio,
    styleId: input.styleId,
    postId: input.postId,
    jobKey,
  });
  return { status: 'success', jobKey };
}

export async function deleteImageAction(
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const r = await deleteImageCore(userId, mediaId);
  if (r.status === 'success') revalidatePath('/media');
  return r;
}

export async function enqueueEditImageAction(input: {
  mediaId: string;
  prompt: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const guard = await editImageGuard(userId, input);
  if (!guard.ok) return { status: 'error', message: guard.message };
  const jobKey = randomUUID();
  await enqueueGenerateImage({
    userId,
    prompt: input.prompt.trim(),
    sourceMediaId: input.mediaId,
    jobKey,
  });
  return { status: 'success', jobKey };
}
