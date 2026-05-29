import { Sparkles } from "lucide-react"
import { CopyButton } from "./copy-button"

export function PromptModule({ prompt, title }: { prompt: string; title?: string }) {
  return (
    <figure className="my-6 border-2 border-ink shadow-brutal">
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-ink bg-accent px-3 py-2 text-accent-ink">
        <span className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest">
          <Sparkles className="size-4" strokeWidth={2.5} />
          {title ?? "Prompt"}
        </span>
        <CopyButton text={prompt} label="Copier le prompt" />
      </figcaption>
      <pre className="overflow-x-auto whitespace-pre-wrap bg-paper p-4 font-mono text-sm leading-relaxed">{prompt}</pre>
    </figure>
  )
}
