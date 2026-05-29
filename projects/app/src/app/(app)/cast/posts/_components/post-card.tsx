import { Film, Image as ImageIcon, Layers } from 'lucide-react';
import Link from 'next/link';
import type { PostWithThumbnail } from '@/lib/db/repositories/posts';

type Props = {
  post: PostWithThumbnail;
};

export function PostCard({ post }: Props) {
  const excerpt = post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content;
  const showImage = post.thumbnail !== null && post.thumbnail.kind !== 'video';

  return (
    <Link
      href={`/cast/posts/${post.id}`}
      className="group block overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/20"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail!.url}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            {post.thumbnail?.kind === 'video' ? (
              <Film className="h-7 w-7 opacity-40" />
            ) : (
              <ImageIcon className="h-7 w-7 opacity-30" />
            )}
            <span className="text-xs opacity-60">
              {post.thumbnail?.kind === 'video' ? 'Vidéo' : 'Aucun visuel'}
            </span>
          </div>
        )}
        {post.thumbnail?.kind === 'pdf' ? (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <Layers className="h-3 w-3" />
            PDF
          </span>
        ) : null}
      </div>

      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-1 font-medium leading-snug">{post.title || 'Sans titre'}</h3>
        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{excerpt}</p>
        <div className="flex items-center justify-between pt-1 text-muted-foreground/80 text-xs">
          <span className="font-mono">#{post.id.slice(0, 8)}</span>
          <span>
            {new Date(post.updatedAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
