import { cn } from "@/lib/utils"

export function Card({
  shadow = true,
  interactive = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shadow?: boolean; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "border-2 border-ink bg-paper",
        shadow && "shadow-brutal",
        interactive && "press",
        className,
      )}
      {...props}
    />
  )
}
