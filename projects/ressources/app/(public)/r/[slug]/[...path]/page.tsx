import type { Metadata } from "next"
import { getResourceMeta } from "@/lib/content/queries"
import { buildResourceMetadata } from "@/lib/content/metadata"
import { resourceUrl } from "@/lib/resources/service"
import { renderResourcePage } from "../render"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>
}): Promise<Metadata> {
  const { slug } = await params
  const meta = await getResourceMeta(slug)
  if (!meta || !meta.published) return { title: "Ressources" }
  return buildResourceMetadata({
    title: meta.title,
    description: meta.description,
    coverImageUrl: meta.coverImageUrl,
    url: resourceUrl(slug),
  })
}

export default async function ResourceSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; path: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug, path } = await params
  const sp = await searchParams
  return renderResourcePage(slug, path, { preview: sp.preview === "1", searchParams: sp })
}
