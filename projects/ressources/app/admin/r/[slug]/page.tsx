import { notFound } from "next/navigation"
import { Eye, Trash2 } from "lucide-react"
import { getResource, listAccess } from "@/lib/resources/service"
import { getResourceStats } from "@/lib/stats/queries"
import { requireOperator } from "@/lib/auth/operator"
import {
  updateResourceMetaAction,
  deleteResourceAction,
  grantAccessAction,
  revokeAccessAction,
} from "@/lib/actions/admin"
import { PageTreeEditor } from "@/components/admin/page-tree-editor"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export const dynamic = "force-dynamic"

type TreeNode = { id: string; slug: string; title: string; path: string[]; children: TreeNode[] }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-xs font-extrabold text-muted-foreground">{children}</h2>
}

export default async function ResourceEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const op = await requireOperator()
  let data: Awaited<ReturnType<typeof getResource>>
  try {
    data = await getResource(op, slug)
  } catch {
    notFound()
  }
  const stats = await getResourceStats(op.id, slug)
  const grantedEmails = data.visibility === "private" ? await listAccess(op.id, slug) : []

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">{data.title}</h1>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge variant={data.published ? "default" : "outline"}>{data.published ? "Publié" : "Brouillon"}</Badge>
            {data.featured && <Badge variant="secondary">★ Featured</Badge>}
            <Badge variant="outline">{data.visibility}</Badge>
          </div>
        </div>
        <a
          href={`/o/${op.handle}/r/${slug}?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2 text-sm font-bold shadow-sm"
        >
          <Eye className="size-4" strokeWidth={2.5} /> Aperçu
        </a>
      </div>

      <section className="border border-border bg-background p-5 shadow sm:p-6">
        <SectionTitle>Métadonnées</SectionTitle>
        <form action={updateResourceMetaAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input name="title" defaultValue={data.title} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={data.description ?? ""} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Image de couverture (URL R2)</Label>
            <Input name="coverImageUrl" defaultValue={data.coverImageUrl ?? ""} placeholder="https://…" />
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm font-bold">
              Visibilité
              <select name="visibility" defaultValue={data.visibility} className="border border-border bg-background px-2 py-1">
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="published" defaultChecked={data.published} className="size-4 accent-[var(--primary)]" /> Publié
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="featured" defaultChecked={data.featured} className="size-4 accent-[var(--primary)]" /> Featured
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex border border-border bg-primary px-5 py-2.5 font-bold text-primary-foreground shadow"
          >
            Enregistrer
          </button>
        </form>
      </section>

      {data.visibility === "private" && (
        <section className="border border-border bg-background p-5 shadow sm:p-6">
          <SectionTitle>Accès privé</SectionTitle>
          <ul className="mb-4 space-y-2">
            {grantedEmails.map((e) => (
              <li key={e} className="flex items-center justify-between gap-2 border border-border px-3 py-2">
                <span className="text-sm">{e}</span>
                <form action={revokeAccessAction}>
                  <input type="hidden" name="resourceSlug" value={slug} />
                  <input type="hidden" name="email" value={e} />
                  <button type="submit" className="text-xs font-bold text-muted-foreground hover:text-primary">
                    Retirer
                  </button>
                </form>
              </li>
            ))}
            {grantedEmails.length === 0 && <li className="text-sm text-muted-foreground">Aucun accès attribué.</li>}
          </ul>
          <form action={grantAccessAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="resourceSlug" value={slug} />
            <Input name="email" type="email" required placeholder="email@client.com" className="flex-1" />
            <button
              type="submit"
              className="border border-border bg-background px-4 py-2 font-bold shadow-sm"
            >
              Attribuer
            </button>
          </form>
        </section>
      )}

      <section>
        <SectionTitle>Pages</SectionTitle>
        <PageTreeEditor root={data.root as TreeNode} resourceSlug={slug} />
      </section>

      <section className="border border-border bg-background p-5 shadow sm:p-6">
        <SectionTitle>Statistiques</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-black">{stats.totalPageViews}</div>
            <div className="text-[0.7rem] text-muted-foreground">vues</div>
          </div>
          <div>
            <div className="text-2xl font-black">{stats.uniqueViewers}</div>
            <div className="text-[0.7rem] text-muted-foreground">uniques</div>
          </div>
          <div>
            <div className="text-2xl font-black">{stats.gateImpressions}</div>
            <div className="text-[0.7rem] text-muted-foreground">gate</div>
          </div>
        </div>
        {stats.perPage.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            {stats.perPage.map((p) => (
              <li key={p.pageId} className="flex justify-between">
                <span className="text-muted-foreground">{p.title}</span>
                <span className="font-bold">{p.views}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-border bg-background p-5 shadow sm:p-6">
        <SectionTitle>Sources</SectionTitle>
        {stats.bySource.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune provenance encore. Ajoute <code>?utm_source=…&amp;utm_campaign=…</code> à tes liens.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] text-muted-foreground">
                <th className="pb-2">Source</th>
                <th className="pb-2 text-right">Vues</th>
                <th className="pb-2 text-right">Gate</th>
                <th className="pb-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySource.map((s) => (
                <tr key={s.source} className="border-b border-border/20">
                  <td className="py-1.5 font-bold">{s.source}</td>
                  <td className="py-1.5 text-right">{s.pageViews}</td>
                  <td className="py-1.5 text-right">{s.gateImpressions}</td>
                  <td className="py-1.5 text-right font-bold">{s.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border border-primary bg-accent p-5 shadow sm:p-6">
        <SectionTitle>Zone de danger</SectionTitle>
        <form action={deleteResourceAction} className="flex items-center justify-between gap-4">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-muted-foreground">La suppression est définitive (pages et modules inclus).</p>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-2 border border-border bg-background px-4 py-2 font-bold shadow-sm"
          >
            <Trash2 className="size-4" strokeWidth={2.5} /> Supprimer
          </button>
        </form>
      </section>
    </div>
  )
}
