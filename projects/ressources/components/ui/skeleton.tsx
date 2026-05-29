/* @generated — synchronisé depuis packages/ui par bin/ui-sync. Ne pas éditer ici : modifier packages/ui puis relancer la synchro. */
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
