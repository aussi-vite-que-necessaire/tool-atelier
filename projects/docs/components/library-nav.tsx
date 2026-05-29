import Link from "next/link"
import { cn } from "@/lib/utils"

const links = [
  { href: "/bibliotheque", label: "Ma bibliothèque", key: "library" as const },
  { href: "/compte", label: "Mon compte", key: "account" as const },
]

export function LibraryNav({ active }: { active?: "library" | "account" }) {
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          className={cn(
            "border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
            l.key === active
              ? "border-ink bg-ink text-paper"
              : "border-transparent text-ink-soft hover:text-ink",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
