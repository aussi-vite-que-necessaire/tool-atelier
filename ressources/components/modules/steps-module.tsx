import { Markdown } from "@/components/reader/markdown"

export function StepsModule({ steps }: { steps: { title: string; md: string }[] }) {
  return (
    <ol className="my-6">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && <span className="absolute bottom-0 left-[19px] top-11 w-0.5 bg-ink" />}
          <span className="z-10 grid size-10 shrink-0 place-items-center border-2 border-ink bg-accent font-mono text-lg font-black text-accent-ink shadow-brutal-sm">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1.5">
            <h3 className="text-lg font-bold leading-tight">{s.title}</h3>
            <div className="mt-1">
              <Markdown>{s.md}</Markdown>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
