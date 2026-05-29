import { redirect } from "next/navigation"
import { env } from "@/lib/env"
import { isPreview } from "@/lib/auth/preview"

export const dynamic = "force-dynamic"

// Page conservée comme point d'entrée nommé "/connexion" : redirige vers le SSO
// central (auth.contentos.ch) avec le retour demandé. En preview, on retombe
// directement sur la cible (auto-login implicite via fetchSession court-circuité).
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; redirectTo?: string }>
}) {
  const sp = await searchParams
  const target = sp.redirect || sp.redirectTo || "/bibliotheque"
  const absoluteTarget = target.startsWith("http")
    ? target
    : `${env.APP_URL}${target.startsWith("/") ? target : `/${target}`}`

  if (isPreview) redirect(target)
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(absoluteTarget)}`)
}
