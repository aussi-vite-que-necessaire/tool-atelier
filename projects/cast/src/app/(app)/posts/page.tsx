import { requireUserId } from '@/lib/auth/session';
import { listPostsWithMedia } from '@/lib/db/repositories/posts';
import { EmptyPostsState } from './_components/empty-state';
import { PostCard } from './_components/post-card';
import { PostCreateForm } from './_components/post-create-form';

export default async function PostsPage() {
  const userId = await requireUserId();
  const posts = await listPostsWithMedia(userId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-bold text-2xl tracking-tight">Posts</h1>
        <p className="text-muted-foreground text-sm">
          {posts.length === 0
            ? 'Rédige, illustre et planifie tes publications LinkedIn.'
            : `${posts.length} post${posts.length > 1 ? 's' : ''} · brouillons et publications`}
        </p>
      </header>

      <PostCreateForm />

      {posts.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
