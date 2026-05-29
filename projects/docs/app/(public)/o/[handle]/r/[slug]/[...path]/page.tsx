import type { Metadata } from "next"
import { getResourceMeta } from "@/lib/content/queries"
import { buildResourceMetadata } from "@/lib/content/metadata"
import { operatorByHandle } from "@/lib/auth/operator"
import { resourceUrl } from "@/lib/resources/service"
import { renderResourcePage } from "../render"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string; path: string[] }>
}): Promise<Metadata> {
  const { handle, slug } = await params
  const op = await operatorByHandle(handle)
  if (!op) return { title: "Ressources" }
  const meta = await getResourceMeta(op.id, slug)
  if (!meta || !meta.published) return { title: "Ressources" }
  return buildResourceMetadata({
    title: meta.title,
    description: meta.description,
    coverImageUrl: meta.coverImageUrl,
    url: resourceUrl(handle, slug),
  })
}

export default async function ResourceSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string; slug: string; path: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { handle, slug, path } = await params
  const sp = await searchParams
  return renderResourcePage(handle, slug, path, { preview: sp.preview === "1", searchParams: sp })
}
