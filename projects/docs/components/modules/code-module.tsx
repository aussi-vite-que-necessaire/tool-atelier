import { highlight } from "@/lib/modules/highlighter"
import { CopyButton } from "./copy-button"

export async function CodeModule({ language, code, filename }: { language: string; code: string; filename?: string }) {
  const html = await highlight(code, language)
  return (
    <figure className="my-6 border-2 border-ink shadow-brutal">
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-ink bg-paper-2 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className="bg-accent px-1.5 py-0.5 font-mono font-bold uppercase tracking-wider text-accent-ink">
            {language}
          </span>
          {filename && <span className="truncate font-mono text-ink-soft">{filename}</span>}
        </span>
        <CopyButton text={code} />
      </figcaption>
      <div className="overflow-x-auto bg-paper p-4 text-sm [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  )
}
