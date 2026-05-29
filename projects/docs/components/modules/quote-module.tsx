import { Quote } from "lucide-react"

export function QuoteModule({
  text,
  author,
  source,
  url,
}: {
  text: string
  author?: string
  source?: string
  url?: string
}) {
  return (
    <figure className="my-8 border-2 border-ink bg-paper-2 p-6 shadow-brutal">
      <Quote className="size-7 text-accent" strokeWidth={2.5} fill="currentColor" />
      <blockquote className="mt-3 text-xl font-medium leading-snug tracking-tight">{text}</blockquote>
      {(author || source) && (
        <figcaption className="mt-4 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
          {author}
          {author && source ? " — " : ""}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline decoration-accent decoration-2 underline-offset-2">
              {source}
            </a>
          ) : (
            source
          )}
        </figcaption>
      )}
    </figure>
  )
}
