import { Markdown } from "@/components/reader/markdown"

export function ComparisonModule({ columns }: { columns: { title: string; md: string }[] }) {
  const cols = columns.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
  return (
    <div className={`my-6 grid grid-cols-1 gap-4 ${cols}`}>
      {columns.map((c, i) => (
        <div key={i} className="border-2 border-ink bg-paper shadow-brutal">
          <h3 className="border-b-2 border-ink bg-paper-2 px-3 py-2 font-mono text-sm font-extrabold uppercase tracking-wide">
            {c.title}
          </h3>
          <div className="px-3 py-2">
            <Markdown>{c.md}</Markdown>
          </div>
        </div>
      ))}
    </div>
  )
}
