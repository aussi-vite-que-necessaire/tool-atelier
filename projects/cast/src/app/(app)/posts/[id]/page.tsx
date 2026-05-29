import { notFound } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getPost } from '@/lib/db/repositories/posts';
import { getLatestPublicationForPost } from '@/lib/db/repositories/publications';
import { getAuthorIdentity } from '@/lib/linkedin/identity';
import type { MediaKind } from '@/lib/media-catalog/kind';
import { PostEditor } from './_components/post-editor';
import type { MediaInfo } from './_components/post-composer';

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

  // Embarquement de la page de création de media (iframe). On dérive les origines
  // de l'env serveur : `embedOrigin` = origine du service media (validation des
  // postMessage), `parentOrigin` = origine publique de cast (transmise à l'iframe).
  const embedOrigin = new URL(env.MEDIA_ENGINE_URL).origin;
  const embedSrc = `${embedOrigin}/embed/new`;
  const parentOrigin = new URL(env.APP_URL).origin;

  return (
    <PostEditor
      post={post}
      mediaInfo={mediaInfo}
      author={author}
      publication={latestPub ?? null}
      embedSrc={embedSrc}
      embedOrigin={embedOrigin}
      parentOrigin={parentOrigin}
    />
  );
}
