import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { Post } from '@/lib/db/schema';

type Props = {
  post: Post;
};

export function PostCard({ post }: Props) {
  const excerpt = post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content;
  return (
    <Link href={`/posts/${post.id}`} className="block">
      <article className="space-y-2 rounded-lg border p-4 transition hover:bg-muted/40">
        <header className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{post.title}</span>
          <Badge variant={post.status === 'validated' ? 'default' : 'secondary'}>
            {post.status}
          </Badge>
        </header>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{excerpt}</p>
        <footer className="flex items-center justify-between text-xs text-muted-foreground">
          <span>#{post.id.slice(0, 8)}</span>
          <span>
            {new Date(post.updatedAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </footer>
      </article>
    </Link>
  );
}
