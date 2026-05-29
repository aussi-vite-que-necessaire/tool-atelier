import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { env } from "@/lib/env"
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview"

export const dynamic = "force-dynamic"

// Page conservée comme point d'entrée nommé "/connexion" : redirige vers le SSO
// central (auth.contentos.ch) avec le retour demandé. En preview, loginRedirect
// auto-connecte user3 (audience), ou montre le chooser si le marqueur est posé.
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

  const cookieHeader = (await headers()).get("cookie")
  redirect(
    loginRedirect({
      authUrl: env.AUTH_URL,
      back: absoluteTarget,
      preview: isPreview,
      cookieHeader,
      defaultUser: DEFAULT_PREVIEW_USER,
    }),
  )
}
