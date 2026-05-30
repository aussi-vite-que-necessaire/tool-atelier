'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import {
  cancelPublication,
  publishNow,
  schedulePublication,
} from '@/lib/publications/publish-core';
import { enqueuePublishLinkedin, removePublishLinkedin } from '@/lib/queue/enqueue';

type Result = { status: 'success'; jobKey?: string } | { status: 'error'; message: string };

export async function publishNowAction(postId: string): Promise<Result> {
  const userId = await requireUserId();
  try {
    const pub = await publishNow(userId, postId, async (id) => {
      await enqueuePublishLinkedin({ publicationId: id, userId });
    });
    revalidatePath(`/cast/posts/${postId}`);
    return { status: 'success', jobKey: pub.id };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}

export async function scheduleAction(input: {
  postId: string;
  whenIso: string;
  tz: string;
}): Promise<Result> {
  const userId = await requireUserId();
  try {
    await schedulePublication(
      userId,
      input.postId,
      new Date(input.whenIso),
      input.tz,
      async (id, delay) => {
        await enqueuePublishLinkedin({ publicationId: id, userId }, delay);
      },
    );
    revalidatePath(`/cast/posts/${input.postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}

export async function cancelScheduleAction(input: {
  postId: string;
  publicationId: string;
}): Promise<Result> {
  const userId = await requireUserId();
  try {
    await cancelPublication(userId, input.publicationId, (id) => removePublishLinkedin(id));
    revalidatePath(`/cast/posts/${input.postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}
