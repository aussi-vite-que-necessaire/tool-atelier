import { notFound } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import { getPost } from '@/lib/db/repositories/posts';
import { getLatestPublicationForPost } from '@/lib/db/repositories/publications';
import { getAuthorIdentity } from '@/lib/linkedin/identity';
import type { MediaKind } from '@/lib/media/types';
import type { MediaInfo } from './_components/post-composer';
import { PostEditor } from './_components/post-editor';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const post = await getPost(userId, id);
  if (!post) notFound();

  const [latestPub, author] = await Promise.all([
    getLatestPublicationForPost(userId, post.id),
    getAuthorIdentity(userId),
  ]);

  const mediaInfo: MediaInfo | null = post.mediaUrl
    ? { kind: (post.mediaKind as MediaKind | null) ?? 'image', url: post.mediaUrl }
    : null;

  return (
    <PostEditor post={post} mediaInfo={mediaInfo} author={author} publication={latestPub ?? null} />
  );
}
