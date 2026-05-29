import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const dynamic = "force-dynamic"

// Landing plateforme. Les ressources ne sont plus listées globalement : elles
// vivent dans l'espace de chaque opérateur (/o/<handle>), partagé par lui à son
// audience (ADR-0002).
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav />} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-20 sm:py-28">
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl">
            Des ressources, partagées par ceux qui les créent
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Chaque créateur publie ses ressources dans son propre espace et les partage à son
            audience. Ouvre un lien d&apos;espace pour explorer, ou retrouve les tiennes dans ta
            bibliothèque.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
