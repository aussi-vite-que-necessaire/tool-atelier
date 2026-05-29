import { PostPreviewPane } from '@/app/(app)/cast/calendar/_components/post-preview-pane';

export default async function PreviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return (
    <div className="mx-auto flex h-[100dvh] max-w-xl flex-col">
      <PostPreviewPane postId={postId} />
    </div>
  );
}
