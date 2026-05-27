import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function CoverArt({ slug, title }: { slug: string; title: string }) {
  const palettes = ["bg-accent text-accent-ink", "bg-ink text-paper", "bg-paper-2 text-ink"]
  const idx = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % palettes.length
  return (
    <div className={`relative grid aspect-[16/9] place-items-center overflow-hidden border-b-2 border-ink ${palettes[idx]}`}>
      <span className="font-mono text-7xl font-black opacity-90">{title.slice(0, 1).toUpperCase()}</span>
      <span className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:repeating-linear-gradient(45deg,transparent,transparent_11px,currentColor_11px,currentColor_12px)]" />
    </div>
  )
}

export function ResourceCard({
  slug,
  title,
  description,
  coverImageUrl,
  tag,
  footer,
}: {
  slug: string
  title: string
  description?: string | null
  coverImageUrl?: string | null
  tag?: string
  footer?: React.ReactNode
}) {
  return (
    <Card className="lift group flex h-full flex-col overflow-hidden">
      <Link href={`/r/${slug}`} className="flex flex-1 flex-col">
        {coverImageUrl ? (
          <div className="aspect-[16/9] overflow-hidden border-b-2 border-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt="" className="size-full object-cover" />
          </div>
        ) : (
          <CoverArt slug={slug} title={title} />
        )}
        <div className="flex flex-1 flex-col p-4">
          {tag && (
            <Badge variant="accent" className="mb-2 self-start">
              {tag}
            </Badge>
          )}
          <h3 className="flex items-start justify-between gap-2 text-xl font-bold leading-tight tracking-tight">
            <span>{title}</span>
            <ArrowUpRight className="size-5 shrink-0 text-ink-soft transition group-hover:text-accent" strokeWidth={2.5} />
          </h3>
          {description && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
      </Link>
      {footer}
    </Card>
  )
}
