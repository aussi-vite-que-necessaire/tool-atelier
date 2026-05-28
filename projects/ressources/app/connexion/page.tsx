import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { OtpForm } from "@/components/auth/otp-form"
import { Logo } from "@/components/brand/logo"

export const dynamic = "force-dynamic"

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; redirectTo?: string }>
}) {
  const sp = await searchParams
  const target = sp.redirect || sp.redirectTo || "/bibliotheque"
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect(target)

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-block">
          <Logo />
        </Link>
        <div className="border-2 border-ink bg-paper p-6 shadow-brutal-lg sm:p-8">
          <h1 className="accent-rule text-3xl font-black tracking-tight">Connexion</h1>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            Reçois un code par email pour accéder à ta bibliothèque de ressources.
          </p>
          <div className="mt-6">
            <OtpForm redirectTo={target} />
          </div>
        </div>
      </div>
    </main>
  )
}
