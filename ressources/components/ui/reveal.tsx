import { cn } from "@/lib/utils"

/**
 * Apparition fondu + translation à la charge de page (animation CSS, sans JS).
 * Le contenu reste présent et visible sans JS et sous `prefers-reduced-motion`.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <div className={cn("rise", className)} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  )
}
