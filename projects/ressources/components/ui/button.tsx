import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 border-2 border-ink font-bold uppercase tracking-wide select-none disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        accent: "bg-accent text-accent-ink shadow-brutal press",
        solid: "bg-ink text-paper shadow-brutal press",
        outline: "bg-paper text-ink shadow-brutal press",
        ghost: "border-transparent text-ink hover:bg-paper-2",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2.5 text-sm",
        lg: "px-6 py-3 text-base",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
