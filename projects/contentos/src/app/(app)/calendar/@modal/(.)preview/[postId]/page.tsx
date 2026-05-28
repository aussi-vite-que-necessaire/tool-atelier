import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';

export default async function InterceptedPreview({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <PostPreviewPane postId={postId} />;
}
