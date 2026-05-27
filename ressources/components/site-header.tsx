import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b-2 border-ink bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        {right}
      </div>
    </header>
  )
}
