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

export const dynamic = "force-dynamic"

type TreeNode = { id: string; slug: string; title: string; path: string[]; children: TreeNode[] }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">{children}</h2>
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
          <h1 className="accent-rule text-4xl font-black tracking-tight">{data.title}</h1>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge variant={data.published ? "solid" : "default"}>{data.published ? "Publié" : "Brouillon"}</Badge>
            {data.featured && <Badge variant="accent">★ Featured</Badge>}
            <Badge>{data.visibility}</Badge>
          </div>
        </div>
        <a
          href={`/o/${op.handle}/r/${slug}?preview=1`}
          target="_blank"
          rel="noreferrer"
          className="press inline-flex items-center gap-2 border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wide shadow-brutal-sm"
        >
          <Eye className="size-4" strokeWidth={2.5} /> Aperçu
        </a>
      </div>

      <section className="border-2 border-ink bg-paper p-5 shadow-brutal sm:p-6">
        <SectionTitle>Métadonnées</SectionTitle>
        <form action={updateResourceMetaAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label">Titre</label>
            <input name="title" defaultValue={data.title} className="field" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" defaultValue={data.description ?? ""} className="field" rows={2} />
          </div>
          <div>
            <label className="label">Image de couverture (URL R2)</label>
            <input name="coverImageUrl" defaultValue={data.coverImageUrl ?? ""} placeholder="https://…" className="field" />
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 text-sm font-bold">
              Visibilité
              <select name="visibility" defaultValue={data.visibility} className="border-2 border-ink bg-paper px-2 py-1">
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="published" defaultChecked={data.published} className="size-4 accent-[var(--accent)]" /> Publié
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" name="featured" defaultChecked={data.featured} className="size-4 accent-[var(--accent)]" /> Featured
            </label>
          </div>
          <button
            type="submit"
            className="press inline-flex border-2 border-ink bg-accent px-5 py-2.5 font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
          >
            Enregistrer
          </button>
        </form>
      </section>

      {data.visibility === "private" && (
        <section className="border-2 border-ink bg-paper p-5 shadow-brutal sm:p-6">
          <SectionTitle>Accès privé</SectionTitle>
          <ul className="mb-4 space-y-2">
            {grantedEmails.map((e) => (
              <li key={e} className="flex items-center justify-between gap-2 border-2 border-ink px-3 py-2">
                <span className="font-mono text-sm">{e}</span>
                <form action={revokeAccessAction}>
                  <input type="hidden" name="resourceSlug" value={slug} />
                  <input type="hidden" name="email" value={e} />
                  <button type="submit" className="text-xs font-bold uppercase text-ink-soft hover:text-accent">
                    Retirer
                  </button>
                </form>
              </li>
            ))}
            {grantedEmails.length === 0 && <li className="text-sm text-ink-soft">Aucun accès attribué.</li>}
          </ul>
          <form action={grantAccessAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="resourceSlug" value={slug} />
            <input name="email" type="email" required placeholder="email@client.com" className="field flex-1" />
            <button
              type="submit"
              className="press border-2 border-ink bg-paper px-4 py-2 font-bold uppercase tracking-wide shadow-brutal-sm"
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

      <section className="border-2 border-ink bg-paper p-5 shadow-brutal sm:p-6">
        <SectionTitle>Statistiques</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="font-mono text-2xl font-black">{stats.totalPageViews}</div>
            <div className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">vues</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-black">{stats.uniqueViewers}</div>
            <div className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">uniques</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-black">{stats.gateImpressions}</div>
            <div className="font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">gate</div>
          </div>
        </div>
        {stats.perPage.length > 0 && (
          <ul className="mt-4 space-y-1 border-t-2 border-ink pt-3 text-sm">
            {stats.perPage.map((p) => (
              <li key={p.pageId} className="flex justify-between">
                <span className="text-ink-soft">{p.title}</span>
                <span className="font-mono font-bold">{p.views}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-2 border-ink bg-paper p-5 shadow-brutal sm:p-6">
        <SectionTitle>Sources</SectionTitle>
        {stats.bySource.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Aucune provenance encore. Ajoute <code className="font-mono">?utm_source=…&amp;utm_campaign=…</code> à tes liens.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">
                <th className="pb-2">Source</th>
                <th className="pb-2 text-right">Vues</th>
                <th className="pb-2 text-right">Gate</th>
                <th className="pb-2 text-right">Users</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySource.map((s) => (
                <tr key={s.source} className="border-b border-ink/20">
                  <td className="py-1.5 font-bold">{s.source}</td>
                  <td className="py-1.5 text-right font-mono">{s.pageViews}</td>
                  <td className="py-1.5 text-right font-mono">{s.gateImpressions}</td>
                  <td className="py-1.5 text-right font-mono font-bold">{s.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border-2 border-accent bg-accent-soft p-5 shadow-[var(--shadow-brutal-accent)] sm:p-6">
        <SectionTitle>Zone de danger</SectionTitle>
        <form action={deleteResourceAction} className="flex items-center justify-between gap-4">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-ink-soft">La suppression est définitive (pages et modules inclus).</p>
          <button
            type="submit"
            className="press inline-flex shrink-0 items-center gap-2 border-2 border-ink bg-paper px-4 py-2 font-bold uppercase tracking-wide shadow-brutal-sm"
          >
            <Trash2 className="size-4" strokeWidth={2.5} /> Supprimer
          </button>
        </form>
      </section>
    </div>
  )
}
