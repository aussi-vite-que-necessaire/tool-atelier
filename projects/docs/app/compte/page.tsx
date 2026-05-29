import Link from "next/link"
import { LogOut, X, Compass } from "lucide-react"
import { requireSession } from "@/lib/auth/session"
import { listSubscriptions } from "@/lib/content/queries"
import { displayName } from "@/lib/account"
import { unsubscribeAction, signOutAction } from "@/lib/actions/account"
import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const dynamic = "force-dynamic"

export default async function ComptePage() {
  const session = await requireSession("/compte")
  const items = await listSubscriptions(session.user.id)
  const { name, email } = session.user

  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav active="account" />} />

      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-12 sm:py-16">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">Espace lecteur</p>
          <h1 className="mt-3 text-5xl font-black tracking-tighter sm:text-6xl">Mon compte</h1>
          <p className="mt-4 font-mono text-sm text-ink-soft">{displayName({ name, email })}</p>
        </section>

        <section className="border-b-2 border-ink py-10">
          <h2 className="mb-6 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Profil</h2>

          <div className="max-w-md">
            <p className="label">Email</p>
            <p className="font-mono text-sm">{email}</p>
          </div>

          {name && (
            <div className="mt-6 max-w-md">
              <p className="label">Nom</p>
              <p className="font-mono text-sm">{name}</p>
            </div>
          )}

          <p className="mt-6 max-w-md text-xs text-ink-soft">
            Le profil est géré sur le compte central de la suite contentos.
          </p>

          <form action={signOutAction} className="mt-8">
            <button
              type="submit"
              className="press inline-flex items-center gap-2 border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-brutal-sm"
            >
              <LogOut className="size-4" strokeWidth={2.5} />
              Se déconnecter
            </button>
          </form>
        </section>

        <section className="py-10">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">Mes ressources</h2>
            <span className="font-mono text-xs text-ink-soft">{items.length.toString().padStart(2, "0")}</span>
          </div>

          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-ink/40 py-16 text-center">
              <Compass className="size-8 text-ink-soft" strokeWidth={2} />
              <p className="mt-3 font-bold">Aucun abonnement.</p>
              <Link
                href="/"
                className="press mt-6 inline-flex items-center gap-2 border-2 border-ink bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
              >
                Explorer les ressources
              </Link>
            </div>
          ) : (
            <ul className="divide-y-2 divide-ink border-2 border-ink">
              {items.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <Link href={`/o/${r.operatorHandle}/r/${r.slug}`} className="font-bold hover:text-accent">
                    {r.title}
                  </Link>
                  <form action={unsubscribeAction}>
                    <input type="hidden" name="resourceId" value={r.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-soft transition-colors hover:text-ink"
                    >
                      <X className="size-3.5" strokeWidth={2.5} />
                      Se désinscrire
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
