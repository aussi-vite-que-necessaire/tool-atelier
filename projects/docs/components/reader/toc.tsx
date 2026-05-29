"use client"

import { useEffect, useState } from "react"
import type { TocItem } from "@/lib/content/toc"
import { cn } from "@/lib/utils"

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null)
    if (headings.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    )
    headings.forEach((h) => obs.observe(h))
    return () => obs.disconnect()
  }, [items])

  if (items.length === 0) return null
  return (
    <nav className="text-sm">
      <div className="mb-3 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Sur cette page</div>
      <ul className="space-y-0.5 border-l-2 border-ink/15">
        {items.map((it) => {
          const isActive = active === it.id
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={cn(
                  "-ml-0.5 block border-l-2 py-1 pl-3 transition-colors",
                  it.depth === 3 && "pl-6",
                  isActive
                    ? "border-accent font-bold text-ink"
                    : "border-transparent text-ink-soft hover:text-ink",
                )}
              >
                {it.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
