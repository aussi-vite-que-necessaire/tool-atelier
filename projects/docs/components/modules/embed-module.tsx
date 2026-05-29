export function EmbedModule({ url }: { url: string }) {
  return (
    <div className="my-6 aspect-video w-full overflow-hidden border-2 border-ink shadow-brutal">
      <iframe
        src={url}
        className="h-full w-full"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  )
}
