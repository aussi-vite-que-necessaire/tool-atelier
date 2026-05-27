import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { PostText } from './post-text';

export type LinkedInStats = { reactions: number; comments: number; reposts: number };

const DEFAULT_STATS: LinkedInStats = { reactions: 128, comments: 14, reposts: 3 };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function LinkedInPostPreview({
  author,
  content,
  image,
  stats = DEFAULT_STATS,
}: {
  author: LinkedInAuthor;
  content: string;
  image?: { url: string } | null;
  stats?: LinkedInStats;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-start gap-2 p-3">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-12 w-12 flex-none rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#0a66c2] font-semibold text-sm text-white">
            {initials(author.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-neutral-900 text-sm">{author.name}</div>
          {author.headline ? (
            <div className="truncate text-neutral-500 text-xs">{author.headline}</div>
          ) : null}
          <div className="text-neutral-500 text-xs">Maintenant · 🌐</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <PostText content={content} />
      </div>
      {image ? <img src={image.url} alt="" className="w-full" /> : null}
      <div className="flex justify-between border-t px-3 py-2 text-neutral-500 text-xs">
        <span>👍❤️👏 {stats.reactions}</span>
        <span>
          {stats.comments} commentaires · {stats.reposts} republications
        </span>
      </div>
      <div className="flex justify-around border-t py-1 font-semibold text-neutral-600 text-sm">
        <span className="px-2 py-1.5">👍 J'aime</span>
        <span className="px-2 py-1.5">💬 Commenter</span>
        <span className="px-2 py-1.5">↪️ Partager</span>
      </div>
    </div>
  );
}
