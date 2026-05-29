import Link from "next/link"
import { headers, cookies } from "next/headers"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { getSession } from "@/lib/auth/session"
import { operatorByHandle } from "@/lib/auth/operator"
import { buildPageTree, type TreePage } from "@/lib/content/tree"
import { resolvePageByPath } from "@/lib/content/resolve"
import { extractToc, type TocItem } from "@/lib/content/toc"
import { canAccess } from "@/lib/access"
import { getResourceBySlug, getGrantedEmails, getPageModules, addSubscription, upsertAudienceMember } from "@/lib/content/queries"
import { isPrefetchRequest } from "@/lib/stats/prefetch"
import { recordPageView, recordGateView } from "@/lib/stats/record"
import { parseRefCookie, parseRefFromRecord, REF_COOKIE } from "@/lib/tracking/ref"
import { ReaderShell } from "@/components/reader/reader-shell"
import { ModuleView } from "@/components/modules/registry"
import { ResourceGate } from "@/components/auth/resource-gate"
import { Reveal } from "@/components/ui/reveal"
import { Badge } from "@/components/ui/badge"

type NavItem = { id: string; title: string; href: string }

function flattenTree(root: TreePage, basePath: string): NavItem[] {
  const out: NavItem[] = []
  const walk = (node: TreePage, prefix: string[]) => {
    const href = prefix.length === 0 ? basePath : `${basePath}/${prefix.join("/")}`
    out.push({ id: node.id, title: node.title, href })
    for (const c of node.children) walk(c, [...prefix, c.slug])
  }
  walk(root, [])
  return out
}

export async function renderResourcePage(
  handle: string,
  slug: string,
  path: string[],
  opts?: { preview?: boolean; searchParams?: Record<string, string | string[] | undefined> },
) {
  const operator = await operatorByHandle(handle)
  if (!operator) notFound()

  const h = await headers()
  // URL d'abord (présente au 1er clic, avant que le cookie ne soit lisible), cookie en repli (first-touch persisté).
  const ref = parseRefFromRecord(opts?.searchParams) ?? parseRefCookie((await cookies()).get(REF_COOKIE)?.value)
  const session = await getSession()
  // L'aperçu (brouillons inclus) est réservé au propriétaire de l'espace.
  const isOwner = !!session && session.user.id === operator.id
  const preview = !!opts?.preview && isOwner

  const data = await getResourceBySlug(operator.id, slug, preview)
  if (!data) notFound()

  if (!preview) {
    const email = session?.user.email ?? null
    const grantedEmails = data.resource.visibility === "private" ? await getGrantedEmails(data.resource.id) : []
    if (!canAccess(data.resource, email, grantedEmails)) {
      if (!isPrefetchRequest(h)) await recordGateView(data.resource.id, session?.user.id ?? null, ref)
      return (
        <ResourceGate
          title={data.resource.title}
          description={data.resource.description}
          coverImageUrl={data.resource.coverImageUrl}
        />
      )
    }
    if (session) {
      await addSubscription(session.user.id, data.resource.id, ref)
      // Rattache le lecteur à l'audience de l'opérateur (sauf l'opérateur lui-même).
      if (!isOwner) await upsertAudienceMember(operator.id, session.user.id, ref)
    }
  }

  const root = buildPageTree(data.flatPages)
  if (!root) notFound()

  const page = resolvePageByPath(root, path)
  if (!page) notFound()

  if (!preview && !isPrefetchRequest(h)) {
    await recordPageView(data.resource.id, page.id, session?.user.id ?? null, ref)
  }

  const mods = await getPageModules(page.id)

  const toc: TocItem[] = mods
    .filter((m) => m.type === "markdown" || m.type === "callout")
    .flatMap((m) => extractToc((m.content as { md: string }).md))

  const basePath = `/o/${handle}/r/${slug}`
  const flat = flattenTree(root, basePath)
  const idx = flat.findIndex((p) => p.id === page.id)
  const prev = idx > 0 ? flat[idx - 1] : null
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null

  return (
    <ReaderShell resourceTitle={data.resource.title} root={root} basePath={basePath} currentId={page.id} toc={toc}>
      {preview && (
        <div className="mb-6 flex items-center gap-2 border-2 border-ink bg-c-warn px-3 py-2 shadow-brutal-sm">
          <Badge variant="accent">Aperçu</Badge>
          <span className="font-mono text-xs font-bold uppercase tracking-wide">
            {data.resource.published ? "Publiée" : "Brouillon"} · {data.resource.visibility}
          </span>
        </div>
      )}

      <header className="mb-8">
        <h1 className="accent-rule text-4xl font-black tracking-tight sm:text-5xl">{page.title}</h1>
      </header>

      <div className="reader-flow">
        {mods.map((m, i) => (
          <Reveal key={m.id} delay={Math.min(i * 0.04, 0.2)}>
            <ModuleView module={m} />
          </Reveal>
        ))}
      </div>

      {(prev || next) && (
        <nav className="mt-14 grid gap-3 border-t-2 border-ink pt-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={prev.href}
              className="press flex flex-col gap-1 border-2 border-ink bg-paper p-4 shadow-brutal-sm"
            >
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
                <ArrowLeft className="size-3.5" strokeWidth={2.5} /> Précédent
              </span>
              <span className="font-bold">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link
              href={next.href}
              className="press flex flex-col gap-1 border-2 border-ink bg-paper p-4 text-right shadow-brutal-sm"
            >
              <span className="inline-flex items-center justify-end gap-1 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
                Suivant <ArrowRight className="size-3.5" strokeWidth={2.5} />
              </span>
              <span className="font-bold">{next.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
        </nav>
      )}
    </ReaderShell>
  )
}
