import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { type ImageAsset, imageAssets, type Media, media } from '../schema';

export type CreateImageAssetInput = {
  mediaId: string;
  source: 'template' | 'standalone';
  templateSlug?: string | null;
  vars?: unknown;
  aiBrief?: string | null;
  aiSourceKey?: string | null;
  styleId?: string | null;
};

export type UpdateImageAssetPatch = Partial<Omit<CreateImageAssetInput, 'mediaId'>>;

// Helper : sous-requête des media_ids qui appartiennent au user.
// Utilisé pour scoper toutes les ops de image_assets sans colonne user_id directe.
function ownedMediaIds(userId: string) {
  return db.select({ id: media.id }).from(media).where(eq(media.userId, userId));
}

export async function createImageAsset(
  userId: string,
  data: CreateImageAssetInput,
): Promise<ImageAsset> {
  // Vérifier que le media appartient bien au user avant d'insérer (sinon
  // FK passerait mais on créerait un image_assets pour un media d'un autre user).
  const owned = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, data.mediaId), eq(media.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    throw new Error('media not found or not owned by user');
  }

  const [row] = await db
    .insert(imageAssets)
    .values({
      mediaId: data.mediaId,
      source: data.source,
      templateSlug: data.templateSlug ?? null,
      vars: data.vars ?? null,
      aiBrief: data.aiBrief ?? null,
      aiSourceKey: data.aiSourceKey ?? null,
      styleId: data.styleId ?? null,
    })
    .returning();
  return row!;
}

export async function getImageAsset(
  userId: string,
  mediaId: string,
): Promise<ImageAsset | undefined> {
  const rows = await db
    .select()
    .from(imageAssets)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    )
    .limit(1);
  return rows[0];
}

export async function updateImageAsset(
  userId: string,
  mediaId: string,
  patch: UpdateImageAssetPatch,
): Promise<ImageAsset | undefined> {
  const rows = await db
    .update(imageAssets)
    .set(patch)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    )
    .returning();
  return rows[0];
}

export async function deleteImageAsset(userId: string, mediaId: string): Promise<void> {
  await db
    .delete(imageAssets)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    );
}

export type StandaloneImage = { media: Media; asset: ImageAsset };

// Galerie : images standalone (upload + IA) du user, plus récentes d'abord.
// Exclut les images source='template' (rendus par-post, pas des assets réutilisables).
export async function listStandaloneImages(userId: string): Promise<StandaloneImage[]> {
  const rows = await db
    .select({ media, asset: imageAssets })
    .from(imageAssets)
    .innerJoin(media, eq(imageAssets.mediaId, media.id))
    .where(and(eq(media.userId, userId), eq(imageAssets.source, 'standalone')))
    .orderBy(desc(media.createdAt));
  return rows.map((r) => ({ media: r.media, asset: r.asset }));
}
