import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getCarouselSlides } from '@/lib/db/repositories/carousels';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost } from '@/lib/db/repositories/posts';
import { getLatestPublicationForPost } from '@/lib/db/repositories/publications';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';
import { getAuthorIdentity } from '@/lib/linkedin/identity';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';
import { PostEditor } from './_components/post-editor';
import { PublishPanel } from './_components/publish-panel';
import type { TemplatePreview } from './_components/template-thumbnail';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const post = await getPost(userId, id);
  if (!post) notFound();

  const [templates, styles, galleryImagesRaw, latestPub, brand, author] = await Promise.all([
    listVisualTemplates(userId),
    listVisualStyles(userId),
    listStandaloneImages(userId),
    getLatestPublicationForPost(userId, post.id),
    buildBrandContext(userId),
    getAuthorIdentity(userId),
  ]);

  const templatePreviews: TemplatePreview[] = templates.map((t) => ({
    id: t.id,
    label: t.label,
    platform: t.platform,
    width: t.width,
    height: t.height,
    html: buildPreviewHtml(t, (t.sampleVars as Record<string, unknown>) ?? {}, brand),
  }));

  // assetKey = URL publique engine → utilisée directement pour l'affichage.
  const galleryImages = galleryImagesRaw.map(({ media }) => ({
    mediaId: media.id,
    assetKey: media.assetKey,
    width: media.width,
    height: media.height,
    url: media.assetKey,
  }));

  type MediaInfo = {
    kind: 'image' | 'carousel' | 'video';
    url: string;
    width: number;
    height: number;
    slideUrls?: string[];
  };
  let mediaInfo: MediaInfo | null = null;
  if (post.mediaId) {
    const m = await getMedia(userId, post.mediaId);
    if (m) {
      try {
        const base: MediaInfo = {
          kind: m.kind,
          url: m.assetKey, // assetKey = URL publique engine
          width: m.width,
          height: m.height,
        };
        if (m.kind === 'carousel') {
          const slides = await getCarouselSlides(m.id);
          // slideKey = assetKey des slides → URL publique engine
          base.slideUrls = slides.map((s) => s.slideKey);
        }
        mediaInfo = base;
      } catch {
        mediaInfo = null;
      }
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/posts" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        ← Tous les posts
      </Link>
      <PostEditor
        post={post}
        templates={templates}
        templatePreviews={templatePreviews}
        styles={styles.map((s) => ({ id: s.id, name: s.name }))}
        galleryImages={galleryImages}
        mediaInfo={mediaInfo}
        author={author}
      />
      <PublishPanel postId={post.id} publication={latestPub ?? null} />
    </div>
  );
}
