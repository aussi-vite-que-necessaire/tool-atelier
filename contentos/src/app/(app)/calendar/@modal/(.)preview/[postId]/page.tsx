import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';
import { PreviewDialog } from '@/app/(app)/calendar/_components/preview-dialog';

export default async function InterceptedPreview({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <PreviewDialog>
      <PostPreviewPane postId={postId} />
    </PreviewDialog>
  );
}
