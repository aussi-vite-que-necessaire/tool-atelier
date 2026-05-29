import Link from "next/link"
import { LogOut } from "lucide-react"
import { requireOperator } from "@/lib/auth/operator"
import { signOutAction } from "@/lib/actions/account"
import { Logo } from "@/components/brand/logo"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperator()
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 h-14 border-b-2 border-ink bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href="/admin" className="shrink-0">
              <Logo label="Admin" />
            </Link>
            <nav className="flex gap-4 font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
              <Link href="/admin" className="hover:text-ink">
                Bord
              </Link>
              <Link href="/admin/audience" className="hover:text-ink">
                Audience
              </Link>
              <Link href={`/o/${op.handle}`} className="hover:text-ink">
                Espace ↗
              </Link>
            </nav>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="press inline-flex items-center gap-2 border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-brutal-sm"
            >
              <LogOut className="size-4" strokeWidth={2.5} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  )
}
