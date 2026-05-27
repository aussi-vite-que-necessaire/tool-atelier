import { Library } from "lucide-react"
import { listFeaturedResources } from "@/lib/content/queries"
import { ResourceCard } from "@/components/resource-card"
import { LibraryNav } from "@/components/library-nav"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Reveal } from "@/components/ui/reveal"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const items = await listFeaturedResources()
  return (
    <div className="min-h-screen">
      <SiteHeader right={<LibraryNav />} />

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-b-2 border-ink py-16 sm:py-24">
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl">
            Ressources pour progresser avec l&apos;IA
          </h1>
        </section>

        <section className="py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">
              Toutes les ressources
            </h2>
            <span className="font-mono text-xs text-ink-soft">
              {items.length.toString().padStart(2, "0")}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="grid place-items-center border-2 border-dashed border-ink/40 py-20 text-center">
              <Library className="size-8 text-ink-soft" strokeWidth={2} />
              <p className="mt-3 font-bold">Aucune ressource publiée pour l&apos;instant.</p>
              <p className="mt-1 text-sm text-ink-soft">Les nouvelles ressources apparaîtront ici.</p>
            </div>
          ) : (
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
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
