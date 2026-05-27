import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Compass } from "lucide-react"
import { auth } from "@/lib/auth"
import { listSubscriptions } from "@/lib/content/queries"
import { ResourceCard } from "@/components/resource-card"
import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Reveal } from "@/components/ui/reveal"

export const dynamic = "force-dynamic"

export default async function BibliothequePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/connexion")

  const items = await listSubscriptions(session.user.id)

  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav active="library" />} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-12 sm:py-16">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">Espace lecteur</p>
          <h1 className="mt-3 text-5xl font-black tracking-tighter sm:text-6xl">Ma bibliothèque</h1>
          <p className="mt-4 font-mono text-sm text-ink-soft">{session.user.email}</p>
        </section>

        <section className="py-12">
          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-ink/40 py-20 text-center">
              <Compass className="size-8 text-ink-soft" strokeWidth={2} />
              <p className="mt-3 font-bold">Ta bibliothèque est vide.</p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                Les ressources auxquelles tu accèdes se rangent ici automatiquement.
              </p>
              <Link
                href="/"
                className="press mt-6 inline-flex items-center gap-2 border-2 border-ink bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
              >
                Explorer les ressources
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-end justify-between">
                <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">
                  Mes ressources
                </h2>
                <span className="font-mono text-xs text-ink-soft">{items.length.toString().padStart(2, "0")}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((r, i) => (
                  <Reveal key={r.id} delay={Math.min(i * 0.05, 0.3)} className="h-full">
                    <ResourceCard
                      slug={r.slug}
                      title={r.title}
                      description={r.description}
                      coverImageUrl={r.coverImageUrl}
                    />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
