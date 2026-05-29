import Link from "next/link"
import { Plus } from "lucide-react"
import { addPageAction, renamePageAction, deletePageAction, movePageAction } from "@/lib/actions/admin"

type Node = { id: string; slug: string; title: string; path: string[]; children: Node[] }

const inp = "border border-border bg-background px-2 py-1 text-sm"
const miniBtn = "border border-border bg-background px-2 py-1 text-sm font-bold hover:bg-muted"

function MoveBtn({
  resourceSlug,
  id,
  orderedIds,
  dir,
}: {
  resourceSlug: string
  id: string
  orderedIds: string
  dir: "up" | "down"
}) {
  return (
    <form action={movePageAction}>
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderedIds" value={orderedIds} />
      <input type="hidden" name="direction" value={dir} />
      <button type="submit" className={miniBtn} aria-label={dir === "up" ? "Monter" : "Descendre"}>
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  )
}

function Level({ nodes, resourceSlug, parentPath }: { nodes: Node[]; resourceSlug: string; parentPath: string[] }) {
  const orderedIds = nodes.map((n) => n.id).join(",")
  return (
    <ul className="space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="border border-border bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/r/${resourceSlug}/p/${node.path.join("/")}`}
              className="font-bold hover:text-primary hover:underline"
            >
              {node.title}
            </Link>
            <span className="text-xs text-muted-foreground">/{node.path.join("/")}</span>
            <span className="ml-auto flex gap-1">
              <MoveBtn resourceSlug={resourceSlug} id={node.id} orderedIds={orderedIds} dir="up" />
              <MoveBtn resourceSlug={resourceSlug} id={node.id} orderedIds={orderedIds} dir="down" />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={renamePageAction} className="flex flex-wrap gap-1">
              <input type="hidden" name="resourceSlug" value={resourceSlug} />
              <input type="hidden" name="path" value={node.path.join("/")} />
              <input name="title" defaultValue={node.title} className={inp} />
              <input name="slug" defaultValue={node.slug} className={`${inp} w-28`} />
              <button type="submit" className={miniBtn}>
                Renommer
              </button>
            </form>
            <form action={deletePageAction}>
              <input type="hidden" name="resourceSlug" value={resourceSlug} />
              <input type="hidden" name="path" value={node.path.join("/")} />
              <button type="submit" className="px-1 text-xs font-bold text-muted-foreground hover:text-primary">
                Supprimer
              </button>
            </form>
          </div>
          {node.children.length > 0 && (
            <div className="ml-3 mt-3 border-l-2 border-border/20 pl-3">
              <Level nodes={node.children} resourceSlug={resourceSlug} parentPath={node.path} />
            </div>
          )}
        </li>
      ))}
      <li>
        <form action={addPageAction} className="flex flex-wrap items-center gap-1 border border-dashed border-border/50 p-2">
          <input type="hidden" name="resourceSlug" value={resourceSlug} />
          <input type="hidden" name="parentPath" value={parentPath.join("/")} />
          <input name="title" placeholder="Titre sous-page" required className={inp} />
          <input name="slug" placeholder="slug" required className={`${inp} w-28`} />
          <button type="submit" className="inline-flex items-center gap-1 border border-border bg-background px-2 py-1 text-sm font-bold hover:bg-muted">
            <Plus className="size-3.5" strokeWidth={3} /> Sous-page
          </button>
        </form>
      </li>
    </ul>
  )
}

export function PageTreeEditor({ root, resourceSlug }: { root: Node; resourceSlug: string }) {
  return (
    <div>
      <Link
        href={`/admin/r/${resourceSlug}/p/`}
        className="inline-block font-bold hover:text-primary hover:underline"
      >
        {root.title} <span className="text-xs font-normal text-muted-foreground">(page racine)</span>
      </Link>
      <div className="mt-3">
        <Level nodes={root.children} resourceSlug={resourceSlug} parentPath={[]} />
      </div>
    </div>
  )
}
