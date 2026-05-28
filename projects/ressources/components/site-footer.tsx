import { Logo } from "@/components/brand/logo"

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-8 sm:px-6">
        <Logo />
        <span className="font-mono text-xs uppercase tracking-widest text-ink-soft">
          Pour approfondir l&apos;IA, l&apos;automatisation et le cloud.
        </span>
      </div>
    </footer>
  )
}
