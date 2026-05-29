import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getPost } from '@/lib/db/repositories/posts';
import { getPublishedExternalUrlForPost } from '@/lib/db/repositories/publications';
import { getAuthorIdentity } from '@/lib/linkedin/identity';

export async function PostPreviewPane({ postId }: { postId: string }) {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) notFound();
  const author = await getAuthorIdentity(userId);
  const image = post.mediaKind === 'image' && post.mediaUrl ? { url: post.mediaUrl } : null;
  const publishedUrl = await getPublishedExternalUrlForPost(userId, postId);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-12">
        <LinkedInPostPreview author={author} content={post.content} image={image} />
      </div>
      <div className="flex flex-none flex-col gap-2 border-t p-4">
        <Link
          href={`/posts/${post.id}`}
          className={buttonVariants({ variant: 'default', size: 'default' })}
        >
          Modifier
        </Link>
        {publishedUrl ? (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Voir le post sur LinkedIn
          </a>
        ) : null}
      </div>
    </div>
  );
}
