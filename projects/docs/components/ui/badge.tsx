import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider leading-none",
  {
    variants: {
      variant: {
        default: "bg-paper text-ink",
        solid: "bg-ink text-paper",
        accent: "bg-accent text-accent-ink border-accent",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
