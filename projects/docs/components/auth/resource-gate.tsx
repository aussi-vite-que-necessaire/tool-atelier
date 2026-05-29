import Link from "next/link"
import { Lock, ArrowRight } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Badge } from "@/components/ui/badge"

export function ResourceGate({
  title,
  description,
  coverImageUrl,
}: {
  title: string
  description: string | null
  coverImageUrl: string | null
}) {
  // L'authentification est centralisée sur auth.contentos.ch ; on renvoie le
  // visiteur sur /connexion qui sait composer l'URL absolue de retour selon
  // l'environnement (prod = vers auth, preview = no-op).
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 inline-block">
          <Logo />
        </Link>
        <div className="border-2 border-ink bg-paper shadow-brutal-lg">
          {coverImageUrl && (
            <div className="aspect-[16/9] overflow-hidden border-b-2 border-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImageUrl} alt="" className="size-full object-cover" />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <Badge variant="accent" className="mb-3">
              <Lock className="size-3" strokeWidth={3} /> Accès réservé
            </Badge>
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            {description && <p className="mt-3 leading-relaxed text-ink-soft">{description}</p>}
            <div className="mt-6 border-t-2 border-ink pt-6">
              <p className="mb-4 font-bold">Connecte-toi pour accéder à cette ressource.</p>
              <Link
                href="/connexion"
                className="press inline-flex items-center gap-2 border-2 border-ink bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal"
              >
                Se connecter
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
