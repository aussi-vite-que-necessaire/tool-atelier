import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost } from '@/lib/db/repositories/posts';
import { getAuthorIdentity } from '@/lib/linkedin/identity';

export async function PostPreviewPane({ postId }: { postId: string }) {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) notFound();
  const [author, media] = await Promise.all([
    getAuthorIdentity(userId),
    post.mediaId ? getMedia(userId, post.mediaId) : Promise.resolve(undefined),
  ]);
  const image = media && media.kind === 'image' ? { url: media.assetKey } : null;
  return (
    <div className="space-y-3">
      <LinkedInPostPreview author={author} content={post.content} image={image} />
      <Link
        href={`/posts/${post.id}`}
        className={buttonVariants({ variant: 'default', size: 'sm' })}
      >
        Modifier
      </Link>
    </div>
  );
}
