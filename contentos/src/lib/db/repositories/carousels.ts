import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type CarouselSlide, carouselSlides, type Media, media } from '../schema';

export type CreateCarouselInput = {
  assetKey: string;
  previewKey: string;
  width: number;
  height: number;
  slideKeys: string[];
};

export async function createCarousel(userId: string, data: CreateCarouselInput): Promise<Media> {
  const mediaId = createId();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(media)
      .values({
        id: mediaId,
        userId,
        kind: 'carousel',
        assetKey: data.assetKey,
        previewKey: data.previewKey,
        width: data.width,
        height: data.height,
      })
      .returning();
    await tx.insert(carouselSlides).values(
      data.slideKeys.map((slideKey, position) => ({
        id: createId(),
        mediaId,
        position,
        slideKey,
      })),
    );
    return row!;
  });
}

// Carrousel à partir d'un PDF uploadé : pas de slides images (l'aperçu page
// par page sera ajouté plus tard). assetKey = le PDF lui-même.
export async function createPdfCarousel(
  userId: string,
  data: { assetKey: string; width: number; height: number },
): Promise<Media> {
  const [row] = await db
    .insert(media)
    .values({
      id: createId(),
      userId,
      kind: 'carousel',
      assetKey: data.assetKey,
      previewKey: data.assetKey,
      width: data.width,
      height: data.height,
    })
    .returning();
  return row!;
}

export async function getCarouselSlides(mediaId: string): Promise<CarouselSlide[]> {
  return db
    .select()
    .from(carouselSlides)
    .where(eq(carouselSlides.mediaId, mediaId))
    .orderBy(asc(carouselSlides.position));
}

// Résout des clés R2 (assetKey) en lignes media de l'utilisateur (pour composer
// les slides depuis la galerie).
export async function getImageMediaByAssetKeys(
  userId: string,
  assetKeys: string[],
): Promise<Media[]> {
  if (assetKeys.length === 0) return [];
  const rows = await db.select().from(media).where(inArray(media.assetKey, assetKeys));
  return rows.filter((m) => m.userId === userId && m.kind === 'image');
}
