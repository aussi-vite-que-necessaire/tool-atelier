import Link from "next/link"
import type { TreePage } from "@/lib/content/tree"
import { cn } from "@/lib/utils"

function Node({
  node,
  basePath,
  prefix,
  currentId,
}: {
  node: TreePage
  basePath: string
  prefix: string[]
  currentId: string
}) {
  const href = prefix.length === 0 ? basePath : `${basePath}/${prefix.join("/")}`
  const active = node.id === currentId
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative block py-1.5 pl-3 text-sm transition-colors",
          active
            ? "font-bold text-ink before:absolute before:inset-y-1 before:left-0 before:w-1 before:bg-accent"
            : "text-ink-soft hover:text-ink",
        )}
      >
        {node.title}
      </Link>
      {node.children.length > 0 && (
        <ul className="ml-3 space-y-0.5 border-l-2 border-ink/15 pl-2">
          {node.children.map((c) => (
            <Node key={c.id} node={c} basePath={basePath} prefix={[...prefix, c.slug]} currentId={currentId} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function PageTree({ root, basePath, currentId }: { root: TreePage; basePath: string; currentId: string }) {
  return (
    <nav>
      <div className="mb-3 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Sommaire</div>
      <ul className="space-y-0.5">
        <Node node={root} basePath={basePath} prefix={[]} currentId={currentId} />
      </ul>
    </nav>
  )
}
