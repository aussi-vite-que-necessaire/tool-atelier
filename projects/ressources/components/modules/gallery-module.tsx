export function GalleryModule({ images }: { images: { url: string; alt?: string; caption?: string }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      {images.map((img, i) => (
        <figure key={i} className="group border-2 border-ink shadow-brutal-sm">
          <div className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt ?? ""}
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          {img.caption && (
            <figcaption className="border-t-2 border-ink bg-paper px-2 py-1 font-mono text-xs text-ink-soft">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}
