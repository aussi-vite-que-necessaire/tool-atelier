import { FileDown } from "lucide-react"

export function FileModule({
  url,
  label,
  filename,
  size,
}: {
  url: string
  label: string
  filename: string
  size?: number
}) {
  const kb = size ? `${Math.round(size / 1024)} Ko` : null
  return (
    <a
      href={url}
      download
      className="press my-6 flex items-center gap-3 border-2 border-ink bg-paper p-4 shadow-brutal no-underline"
    >
      <span className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-accent text-accent-ink">
        <FileDown className="size-5" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block font-mono text-xs text-ink-soft">
          {filename}
          {kb ? ` · ${kb}` : ""}
        </span>
      </span>
      <span className="hidden font-mono text-xs font-bold uppercase tracking-widest text-ink-soft sm:block">
        Télécharger
      </span>
    </a>
  )
}
