import { cn } from "@/lib/utils"

/** Wordmark : libellé mono en capitales. */
export function Logo({ className, label = "AVQN Ressources" }: { className?: string; label?: string }) {
  return (
    <span className={cn("font-mono text-sm font-extrabold uppercase tracking-[0.2em]", className)}>{label}</span>
  )
}
