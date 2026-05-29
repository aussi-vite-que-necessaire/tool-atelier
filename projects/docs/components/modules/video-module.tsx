export function VideoModule({ url, caption }: { url: string; caption?: string }) {
  return (
    <figure className="my-6">
      <video src={url} controls className="w-full border-2 border-ink shadow-brutal" />
      {caption && (
        <figcaption className="mt-2 font-mono text-xs uppercase tracking-wide text-ink-soft">{caption}</figcaption>
      )}
    </figure>
  )
}
