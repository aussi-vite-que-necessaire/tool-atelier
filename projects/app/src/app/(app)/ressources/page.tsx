import { ArrowUpRight, Eye, Layers, Lock, type LucideIcon, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Heading } from '@/components/ui/typography';
import { listResources } from '@/lib/ressources/service';
import { getStatsOverview } from '@/lib/ressources/stats-queries';
import { createResourceAction } from './actions';
import { requireOperator } from './authz';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ressources — Contentos' };

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <Icon className="size-5 text-primary" strokeWidth={2.5} />
      <div className="mt-3 font-bold text-3xl leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-muted-foreground text-xs">{label}</div>
      {sub && <div className="mt-0.5 text-muted-foreground text-xs">{sub}</div>}
    </Card>
  );
}

export default async function RessourcesDashboard() {
  const op = await requireOperator();
  const [resources, overview] = await Promise.all([
    listResources(op.userId),
    getStatsOverview(op.userId),
  ]);
  const stat = (slug: string) => overview.resources.find((o) => o.slug === slug);
  const totalViews = overview.resources.reduce((a, o) => a + o.pageViews, 0);
  const totalGate = overview.resources.reduce((a, o) => a + o.gateImpressions, 0);
  const totalUsers = overview.resources.reduce((a, o) => a + o.subscribers, 0);
  const published = resources.filter((r) => r.published).length;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Heading level={1}>Bibliothèque</Heading>
          <p className="text-muted-foreground text-sm">
            Tes lead magnets et leur espace public —{' '}
            <Link
              href={`/docs/${op.handle}`}
              className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4 hover:text-primary"
            >
              /docs/{op.handle} <ArrowUpRight className="size-3.5" />
            </Link>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi
          icon={Layers}
          label="Ressources"
          value={resources.length}
          sub={`${published} publiées`}
        />
        <Kpi icon={Eye} label="Vues totales" value={totalViews} />
        <Kpi icon={Lock} label="Vues gate" value={totalGate} />
        <Kpi icon={Users} label="Audience" value={totalUsers} />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Nouvelle ressource
        </h2>
        <form action={createResourceAction} className="flex flex-col gap-2 sm:flex-row">
          <Input
            name="title"
            required
            placeholder="Titre d’une nouvelle ressource"
            className="flex-1"
          />
          <Button type="submit">
            <Plus className="size-4" strokeWidth={3} /> Créer
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Ressources ({resources.length})
        </h2>
        {resources.length === 0 ? (
          <Card className="grid place-items-center border-dashed py-16 text-center">
            <Layers className="size-7 text-muted-foreground" strokeWidth={2} />
            <p className="mt-3 font-medium">Aucune ressource pour l’instant.</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Crée ta première ressource ci-dessus.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {resources.map((r) => {
              const s = stat(r.slug);
              return (
                <Link
                  key={r.slug}
                  href={`/ressources/r/${r.slug}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-lg">{r.title}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={r.published ? 'default' : 'outline'}>
                        {r.published ? 'Publié' : 'Brouillon'}
                      </Badge>
                      {r.featured && <Badge variant="secondary">★ Featured</Badge>}
                      <Badge variant="outline">{r.visibility}</Badge>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-2xl leading-none tabular-nums">
                      {s?.pageViews ?? 0}
                    </div>
                    <div className="mt-1 text-muted-foreground text-xs">
                      vues · {s?.gateImpressions ?? 0} gate · {s?.subscribers ?? 0} users
                    </div>
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      {overview.topSources.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Top sources
          </h2>
          <Card className="divide-y divide-border p-0">
            {overview.topSources.map((src) => (
              <div key={src.source} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-medium">{src.source}</span>
                <span className="text-sm">
                  <span className="font-bold text-lg tabular-nums">{src.users}</span> users
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
