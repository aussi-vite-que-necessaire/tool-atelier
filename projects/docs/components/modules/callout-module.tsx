import { Info, TriangleAlert, Lightbulb } from "lucide-react"
import { Markdown } from "@/components/reader/markdown"

const variants = {
  info: { label: "Info", Icon: Info, bg: "bg-c-info" },
  warn: { label: "Attention", Icon: TriangleAlert, bg: "bg-c-warn" },
  success: { label: "Astuce", Icon: Lightbulb, bg: "bg-c-success" },
} as const

export function CalloutModule({ variant, md }: { variant: "info" | "warn" | "success"; md: string }) {
  const v = variants[variant] ?? variants.info
  const { Icon } = v
  return (
    <div className={`my-6 flex gap-3 border-2 border-ink ${v.bg} p-4 shadow-brutal`}>
      <span className="grid size-8 shrink-0 place-items-center border-2 border-ink bg-paper">
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-mono text-xs font-extrabold uppercase tracking-widest">{v.label}</div>
        <Markdown>{md}</Markdown>
      </div>
    </div>
  )
}
