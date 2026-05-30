import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { isGeminiConfigured, isStorageConfigured } from '@/lib/media/config';
import { GALLERY_FILTERS } from '@/lib/media/gallery-filters';
import { listMediaRecords } from '@/lib/media/repository';
import type { MediaKind } from '@/lib/media/types';
import { AddMediaLauncher } from './add-media-launcher';
import { GalleryGrid } from './gallery-grid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Galerie — Media' };

const KINDS: MediaKind[] = GALLERY_FILTERS.map((f) => f.kind);

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const userId = await requireUserId();
  const { kind: kindParam } = await searchParams;
  const kind: MediaKind | undefined = KINDS.includes(kindParam as MediaKind)
    ? (kindParam as MediaKind)
    : undefined;

  const storage = isStorageConfigured();
  const geminiAvailable = storage && isGeminiConfigured();
  const items = storage ? await listMediaRecords(userId, { kind, limit: 100 }) : [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Heading level={1}>Galerie</Heading>
          <p className="text-muted-foreground text-sm">
            Tes visuels — générés, rendus, importés ou assemblés —, prêts à attacher à un post.
          </p>
        </div>
        {storage && <AddMediaLauncher geminiAvailable={geminiAvailable} />}
      </header>

      {!storage ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="font-medium text-foreground">Studio média en mode dégradé</p>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
            Le stockage R2 n'est pas configuré dans cet environnement. La création et la galerie
            sont indisponibles ici ; elles s'activent automatiquement en preview et en production.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={!kind ? 'secondary' : 'outline'}
              size="sm"
              render={<Link href="/media/gallery" />}
            >
              Tous
            </Button>
            {GALLERY_FILTERS.map((f) => (
              <Button
                key={f.kind}
                variant={kind === f.kind ? 'secondary' : 'outline'}
                size="sm"
                render={<Link href={`/media/gallery?kind=${f.kind}`} />}
              >
                {f.label}
              </Button>
            ))}
            <span className="ml-auto text-muted-foreground text-sm">
              {items.length} élément{items.length !== 1 ? 's' : ''}
            </span>
          </div>

          <GalleryGrid items={items} geminiAvailable={geminiAvailable} />
        </section>
      )}
    </div>
  );
}
