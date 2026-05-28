export function ImageModule({ url, alt, caption }: { url: string; alt?: string; caption?: string }) {
  return (
    <figure className="my-6">
      {/* URL R2 / externe : <img> volontaire (pas next/image). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt ?? ""} className="w-full border-2 border-ink shadow-brutal" />
      {caption && (
        <figcaption className="mt-2 font-mono text-xs uppercase tracking-wide text-ink-soft">{caption}</figcaption>
      )}
    </figure>
  )
}
