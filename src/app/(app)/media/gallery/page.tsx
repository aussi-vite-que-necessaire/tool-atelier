import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/typography';
import { requireUserId } from '@/lib/auth/session';
import { isGeminiConfigured, isStorageConfigured } from '@/lib/media/config';
import { listMediaRecords } from '@/lib/media/repository';
import { listStyles } from '@/lib/media/styles';
import type { MediaKind } from '@/lib/media/types';
import { CreatePanel } from './create-panel';
import { GalleryGrid } from './gallery-grid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Galerie — Media' };

const KINDS: MediaKind[] = ['image', 'video', 'pdf', 'render'];

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
  const [items, styles] = await Promise.all([
    storage ? listMediaRecords(userId, { kind, limit: 100 }) : Promise.resolve([]),
    storage ? listStyles(userId) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Heading level={1}>Galerie</Heading>
          <p className="text-muted-foreground text-sm">
            Visuels générés, rendus, importés ou assemblés — prêts à attacher à un post.
          </p>
        </div>
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
        <>
          <CreatePanel geminiAvailable={isGeminiConfigured()} styles={styles} />

          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={!kind ? 'secondary' : 'outline'}
                size="sm"
                render={<Link href="/media/gallery" />}
              >
                Tous
              </Button>
              {KINDS.map((k) => (
                <Button
                  key={k}
                  variant={kind === k ? 'secondary' : 'outline'}
                  size="sm"
                  render={<Link href={`/media/gallery?kind=${k}`} />}
                >
                  {k}
                </Button>
              ))}
              <span className="ml-auto text-muted-foreground text-sm">
                {items.length} élément{items.length !== 1 ? 's' : ''}
              </span>
            </div>

            <GalleryGrid items={items} geminiAvailable={isGeminiConfigured()} />
          </section>
        </>
      )}
    </div>
  );
}
