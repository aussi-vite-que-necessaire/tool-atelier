import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';

export default async function PreviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return (
    <div className="mx-auto max-w-xl py-6">
      <PostPreviewPane postId={postId} />
    </div>
  );
}
