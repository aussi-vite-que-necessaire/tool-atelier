import { ChevronRight } from "lucide-react"
import { Markdown } from "@/components/reader/markdown"

export function AccordionModule({ title, md, open }: { title: string; md: string; open?: boolean }) {
  return (
    <details open={open ?? false} className="group my-4 border-2 border-ink bg-paper shadow-brutal">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-bold [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 text-accent transition-transform group-open:rotate-90" strokeWidth={3} />
        {title}
      </summary>
      <div className="border-t-2 border-ink px-4 py-3">
        <Markdown>{md}</Markdown>
      </div>
    </details>
  )
}
