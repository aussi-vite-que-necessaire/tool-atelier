import Link from "next/link"
import { Plus, Eye, Lock, Layers, Users, Download, type LucideIcon } from "lucide-react"
import { listResources } from "@/lib/resources/service"
import { getStatsOverview } from "@/lib/stats/queries"
import { createResourceAction } from "@/lib/actions/admin"
import { requireOperator } from "@/lib/auth/operator"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

function Kpi({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: number; sub?: string }) {
  return (
    <div className="border border-border bg-background p-4 shadow">
      <Icon className="size-5 text-primary" strokeWidth={2.5} />
      <div className="mt-3 text-3xl font-black leading-none">{value}</div>
      <div className="mt-1.5 text-[0.7rem] text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export default async function AdminDashboard() {
  const op = await requireOperator()
  const [resources, overview] = await Promise.all([listResources(op.id), getStatsOverview(op.id)])
  const stat = (slug: string) => overview.resources.find((o) => o.slug === slug)
  const totalViews = overview.resources.reduce((a, o) => a + o.pageViews, 0)
  const totalGate = overview.resources.reduce((a, o) => a + o.gateImpressions, 0)
  const totalUsers = overview.resources.reduce((a, o) => a + o.subscribers, 0)
  const published = resources.filter((r) => r.published).length

  return (
    <div className="space-y-10">
      <h1 className="accent-rule text-4xl font-black tracking-tight">Tableau de bord</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi icon={Layers} label="Ressources" value={resources.length} sub={`${published} publiées`} />
        <Kpi icon={Eye} label="Vues totales" value={totalViews} />
        <Kpi icon={Lock} label="Vues gate" value={totalGate} />
        <Kpi icon={Users} label="Utilisateurs" value={totalUsers} />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-extrabold text-muted-foreground">
          Nouvelle ressource
        </h2>
        <form action={createResourceAction} className="flex flex-col gap-2 sm:flex-row">
          <input name="title" required placeholder="Titre d'une nouvelle ressource" className="field flex-1" />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 border border-border bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow"
          >
            <Plus className="size-4" strokeWidth={3} />
            Créer
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-extrabold text-muted-foreground">
          Ressources ({resources.length})
        </h2>
        <div className="divide-y divide-border border border-border shadow">
          {resources.map((r) => {
            const s = stat(r.slug)
            return (
              <Link
                key={r.slug}
                href={`/admin/r/${r.slug}`}
                className="flex items-center justify-between gap-4 bg-background px-4 py-4 transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold">{r.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={r.published ? "default" : "outline"}>{r.published ? "Publié" : "Brouillon"}</Badge>
                    {r.featured && <Badge variant="secondary">★ Featured</Badge>}
                    <Badge variant="outline">{r.visibility}</Badge>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-black leading-none">{s?.pageViews ?? 0}</div>
                  <div className="mt-1 text-[0.7rem] text-muted-foreground">
                    vues · {s?.gateImpressions ?? 0} gate · {s?.subscribers ?? 0} users
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-extrabold text-muted-foreground">
          Top sources
        </h2>
        {overview.topSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune provenance encore. Tague tes liens avec <code>?utm_source=…</code>.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border shadow">
            {overview.topSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-4 bg-background px-4 py-3">
                <span className="font-bold">{s.source}</span>
                <span className="text-sm">
                  <span className="text-lg font-black">{s.users}</span> users
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-extrabold text-muted-foreground">
          Outils
        </h2>
        <a
          href="https://skills.contentos.ch"
          className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2.5 text-sm font-bold shadow-sm"
        >
          <Download className="size-4" strokeWidth={2.5} /> Récupérer le skill sur skills.contentos.ch
        </a>
      </section>
    </div>
  )
}
