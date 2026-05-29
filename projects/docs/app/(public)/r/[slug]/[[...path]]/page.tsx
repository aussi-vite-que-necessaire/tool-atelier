import { redirect, notFound } from "next/navigation"
import { resolveLegacySlug } from "@/lib/content/queries"

export const dynamic = "force-dynamic"

// Compat : les anciens liens /r/<slug>[/...path] redirigent vers le canonique
// /o/<handle>/r/<slug>[/...path] (multi-tenant, ADR-0002).
export default async function LegacyResourceRedirect({
  params,
}: {
  params: Promise<{ slug: string; path?: string[] }>
}) {
  const { slug, path = [] } = await params
  const handle = await resolveLegacySlug(slug)
  if (!handle) notFound()
  const sub = path.length ? "/" + path.join("/") : ""
  redirect(`/o/${handle}/r/${slug}${sub}`)
}
