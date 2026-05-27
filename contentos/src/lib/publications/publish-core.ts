import { getPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getPublication,
} from '@/lib/db/repositories/publications';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import type { Publication } from '@/lib/db/schema';

export type EnqueueFn = (publicationId: string, delayMs?: number) => Promise<void>;
export type DequeueFn = (publicationId: string) => Promise<void>;

async function buildSnapshot(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (!post) throw new Error('Post introuvable');
  const account = await getSocialAccount(userId, 'linkedin');
  if (!account) throw new Error('Aucun compte LinkedIn connecté');

  // Lit directement les colonnes media du post (découplé du service media)
  const snapshotKeys: string[] | null = post.mediaUrl ? [post.mediaUrl] : null;
  const mediaKind: string | null = post.mediaKind ?? null;

  return { post, account, snapshotKeys, mediaKind };
}

export async function publishNow(
  userId: string,
  postId: string,
  enqueue: EnqueueFn,
): Promise<Publication> {
  const { post, account, snapshotKeys, mediaKind } = await buildSnapshot(userId, postId);
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: post.content,
    platform: 'linkedin',
    socialAccountId: account.id,
    snapshotKeys,
    mediaKind,
    status: 'queued',
  });
  await enqueue(pub.id, undefined);
  return pub;
}

export async function schedulePublication(
  userId: string,
  postId: string,
  when: Date,
  tz: string,
  enqueue: EnqueueFn,
): Promise<Publication> {
  const { post, account, snapshotKeys, mediaKind } = await buildSnapshot(userId, postId);
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: post.content,
    platform: 'linkedin',
    socialAccountId: account.id,
    snapshotKeys,
    mediaKind,
    status: 'scheduled',
    scheduledFor: when,
    scheduledTz: tz,
  });
  await enqueue(pub.id, Math.max(0, when.getTime() - Date.now()));
  return pub;
}

export async function cancelPublication(
  userId: string,
  publicationId: string,
  dequeue: DequeueFn,
): Promise<void> {
  const pub = await getPublication(userId, publicationId);
  if (!pub) return;
  if (pub.status !== 'scheduled' && pub.status !== 'queued') {
    throw new Error('Publication non annulable (déjà en cours ou terminée)');
  }
  await dequeue(publicationId);
  await deletePublication(userId, publicationId);
}

export async function removePublication(
  userId: string,
  publicationId: string,
  dequeue: DequeueFn,
): Promise<void> {
  const pub = await getPublication(userId, publicationId);
  if (!pub) throw new Error('Publication introuvable');
  if (pub.status === 'publishing') {
    throw new Error('Publication en cours, suppression impossible');
  }
  await dequeue(publicationId);
  await deletePublication(userId, publicationId);
}
