import { requireUserId } from '@/lib/auth/session';
import { listPosts } from '@/lib/db/repositories/posts';
import { EmptyPostsState } from './_components/empty-state';
import { PostCard } from './_components/post-card';
import { PostCreateForm } from './_components/post-create-form';

export default async function PostsPage() {
  const userId = await requireUserId();
  const posts = await listPosts(userId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Posts ({posts.length})</h1>
      </header>
      <PostCreateForm />
      {posts.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
