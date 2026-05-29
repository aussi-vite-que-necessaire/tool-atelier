import { ArrowUpRight } from "lucide-react"

export function CtaModule({ label, url, variant }: { label: string; url: string; variant?: "primary" | "secondary" }) {
  const primary = variant !== "secondary"
  return (
    <div className="my-6">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`press inline-flex items-center gap-2 border-2 border-ink px-5 py-3 font-bold uppercase tracking-wide shadow-brutal ${
          primary ? "bg-accent text-accent-ink" : "bg-paper text-ink"
        }`}
      >
        {label}
        <ArrowUpRight className="size-4" strokeWidth={2.5} />
      </a>
    </div>
  )
}
