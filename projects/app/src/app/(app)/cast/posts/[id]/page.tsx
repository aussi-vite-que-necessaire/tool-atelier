import { notFound } from 'next/navigation';
import { isPreview } from '@/lib/auth/preview';
import { requireUserId } from '@/lib/auth/session';
import { getPost } from '@/lib/db/repositories/posts';
import { getLatestPublicationForPost } from '@/lib/db/repositories/publications';
import { env } from '@/lib/env';
import { getAuthorIdentity } from '@/lib/linkedin/identity';
import type { MediaKind } from '@/lib/media-catalog/kind';
import { mediaEmbedOrigin } from '@/lib/media-link/embed';
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

  // Embarquement de la page de création de media (iframe). `embedOrigin` = origine
  // du service media à embarquer (media prod en prod ; media preview de la même
  // branche en preview, qui porte /embed) ; sert aussi à valider les postMessage.
  // `parentOrigin` = origine publique de cast, transmise à l'iframe (qu'elle valide).
  const embedOrigin = mediaEmbedOrigin({
    isPreview,
    appUrl: env.APP_URL,
    mediaEngineUrl: env.MEDIA_ENGINE_URL,
  });
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
