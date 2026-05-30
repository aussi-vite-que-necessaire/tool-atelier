import { Library } from 'lucide-react';
import { notFound } from 'next/navigation';
import { listPublishedResources } from '@/lib/ressources/queries';
import { getOperatorByHandle } from '@/lib/ressources/settings';
import { ResourceCard } from '../../_components/resource-card';
import { ThemeStyle } from '../../_components/theme-style';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const op = await getOperatorByHandle(handle);
  return { title: op ? `${op.brandName ?? op.name} — Ressources` : 'Ressources' };
}

export default async function OperatorSpace({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const op = await getOperatorByHandle(handle);
  if (!op) notFound();
  const items = await listPublishedResources(op.userId);
  const brand = op.brandName ?? op.name;

  return (
    <>
      <ThemeStyle theme={op.theme} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-b-2 border-[var(--res-ink)] py-16 sm:py-24">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-[var(--res-accent)]">
            {brand}
          </p>
          <h1 className="mt-3 max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl">
            Ressources pour progresser
          </h1>
        </section>

        <section className="py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-[var(--res-ink-soft)]">
              Toutes les ressources
            </h2>
            <span className="font-mono text-xs text-[var(--res-ink-soft)] tabular-nums">
              {items.length.toString().padStart(2, '0')}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-[var(--res-ink)]/40 py-20 text-center">
              <Library className="size-8 text-[var(--res-ink-soft)]" strokeWidth={2} />
              <p className="mt-3 font-bold">Aucune ressource publiée pour l’instant.</p>
              <p className="mt-1 text-sm text-[var(--res-ink-soft)]">
                Les nouvelles ressources apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => (
                <ResourceCard
                  key={r.id}
                  handle={op.handle}
                  slug={r.slug}
                  title={r.title}
                  description={r.description}
                  coverImageUrl={r.coverImageUrl}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
