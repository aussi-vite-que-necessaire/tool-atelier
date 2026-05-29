import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getResource } from "@/lib/resources/service"
import { requireOperator } from "@/lib/auth/operator"
import { addModuleAction, updateModuleAction, deleteModuleAction, moveModuleAction } from "@/lib/actions/admin"
import { ModuleForm } from "@/components/admin/module-form"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

type Node = {
  id: string
  slug: string
  title: string
  path: string[]
  modules: { id: string; type: string; position: number; content: Record<string, unknown> }[]
  children: Node[]
}

function findNode(node: Node, path: string[]): Node | null {
  if (path.length === 0) return node
  const [head, ...rest] = path
  const child = node.children.find((c) => c.slug === head)
  return child ? findNode(child, rest) : null
}

const miniBtn = "border border-border bg-background px-2 py-1 text-sm font-bold hover:bg-muted"

function MoveModule({
  slug,
  path,
  id,
  orderedIds,
  dir,
}: {
  slug: string
  path: string[]
  id: string
  orderedIds: string
  dir: "up" | "down"
}) {
  return (
    <form action={moveModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="path" value={path.join("/")} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderedIds" value={orderedIds} />
      <input type="hidden" name="direction" value={dir} />
      <button type="submit" className={miniBtn} aria-label={dir === "up" ? "Monter" : "Descendre"}>
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  )
}

function DeleteModule({ slug, id }: { slug: string; id: string }) {
  return (
    <form action={deleteModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={miniBtn} aria-label="Supprimer le module">
        ✕
      </button>
    </form>
  )
}

export default async function PageEditor({ params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path = [] } = await params
  const op = await requireOperator()
  let data: Awaited<ReturnType<typeof getResource>>
  try {
    data = await getResource(op, slug)
  } catch {
    notFound()
  }
  const page = findNode(data.root as Node, path)
  if (!page) notFound()

  const orderedIds = page.modules.map((m) => m.id).join(",")

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/r/${slug}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.5} /> {data.title}
        </Link>
        <h1 className="accent-rule mt-3 text-3xl font-black tracking-tight">{page.title}</h1>
      </div>

      <ul className="space-y-4">
        {page.modules.map((m) => (
          <li key={m.id} className="border border-border bg-background p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Badge>{m.type}</Badge>
              <span className="ml-auto flex gap-1">
                <MoveModule slug={slug} path={path} id={m.id} orderedIds={orderedIds} dir="up" />
                <MoveModule slug={slug} path={path} id={m.id} orderedIds={orderedIds} dir="down" />
                <DeleteModule slug={slug} id={m.id} />
              </span>
            </div>
            <ModuleForm
              action={updateModuleAction}
              resourceSlug={slug}
              path={path}
              module={{ id: m.id, type: m.type, content: m.content }}
            />
          </li>
        ))}
        {page.modules.length === 0 && (
          <li className="border border-dashed border-border/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun module sur cette page.
          </li>
        )}
      </ul>

      <section className="border border-border bg-muted p-4 shadow sm:p-5">
        <h2 className="mb-3 text-xs font-extrabold text-muted-foreground">
          Ajouter un module
        </h2>
        <ModuleForm action={addModuleAction} resourceSlug={slug} path={path} />
      </section>
    </div>
  )
}
