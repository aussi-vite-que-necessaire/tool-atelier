import { requireUserId } from '@/lib/auth/session';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
import { GalleryAddButton } from './_components/gallery-add-button';
import { ImageCard } from './_components/image-card';

export default async function MediaGalleryPage() {
  const userId = await requireUserId();
  const [images, styles] = await Promise.all([
    listStandaloneImages(userId),
    listVisualStyles(userId),
  ]);

  // assetKey = URL publique engine → utilisée directement pour l'affichage.
  const withUrls = images.map(({ media, asset }) => ({
    mediaId: media.id,
    isAi: asset.aiBrief !== null,
    createdAt: media.createdAt.toISOString(),
    url: media.assetKey,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Galerie</h2>
          <p className="text-sm text-neutral-600">Tes images uploadées ou générées par IA.</p>
        </div>
        <GalleryAddButton styles={styles.map((s) => ({ id: s.id, name: s.name }))} />
      </header>

      {withUrls.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucune image. Ajoute-en une.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {withUrls.map((img) => (
            <ImageCard
              key={img.mediaId}
              mediaId={img.mediaId}
              url={img.url}
              isAi={img.isAi}
              createdAt={img.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
