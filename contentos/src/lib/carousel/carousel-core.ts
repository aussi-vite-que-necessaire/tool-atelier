import { createCarousel, getImageMediaByAssetKeys } from '@/lib/db/repositories/carousels';
import { updatePost } from '@/lib/db/repositories/posts';
import { mimeFromKey } from '@/lib/media/mime';
import { getMediaEngine } from '@/lib/media-engine';
import { buildCarouselPdf } from './build-pdf';

type Result = { status: 'success'; mediaId: string } | { status: 'error'; message: string };

// Compose un carrousel : valide les slides (≥ 2, même format), assemble le PDF,
// l'upload, crée le média carrousel + slides, attache au post.
export async function createCarouselCore(
  userId: string,
  input: { postId: string; slideKeys: string[] },
): Promise<Result> {
  const { postId, slideKeys } = input;
  if (slideKeys.length < 2) {
    return { status: 'error', message: 'Un carrousel demande au moins 2 slides.' };
  }

  const found = await getImageMediaByAssetKeys(userId, slideKeys);
  const byKey = new Map(found.map((m) => [m.assetKey, m]));
  const ordered = slideKeys.map((k) => byKey.get(k));
  if (ordered.some((m) => !m)) {
    return { status: 'error', message: 'Une ou plusieurs images sont introuvables.' };
  }
  const slides = ordered as NonNullable<(typeof ordered)[number]>[];

  // Même proportion (ratio), pas pixels exacts.
  const { width, height } = slides[0]!;
  const ratio = width / height;
  if (slides.some((m) => Math.abs(m.width / m.height - ratio) >= 0.02)) {
    return { status: 'error', message: 'Toutes les slides doivent avoir la même proportion.' };
  }

  const engine = getMediaEngine();
  // assetKey = URL publique engine → on la passe directement à download()
  const slideBytes = await Promise.all(
    slides.map(async (m) => ({
      bytes: await engine.download(m.assetKey),
      type: mimeFromKey(m.assetKey),
    })),
  );

  let pdf: Buffer;
  try {
    pdf = await buildCarouselPdf(slideBytes, { width, height });
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }

  const obj = await engine.upload({ bytes: pdf, contentType: 'application/pdf' });

  const carousel = await createCarousel(userId, {
    assetKey: obj.url,
    previewKey: slides[0]!.assetKey,
    width,
    height,
    slideKeys,
  });
  await updatePost(userId, postId, { mediaId: carousel.id });
  return { status: 'success', mediaId: carousel.id };
}
