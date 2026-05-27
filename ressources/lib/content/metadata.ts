import type { Metadata } from "next"

export function buildResourceMetadata(input: {
  title: string
  description: string | null
  coverImageUrl: string | null
  url: string
}): Metadata {
  const description = input.description ?? undefined
  const images = input.coverImageUrl ? [input.coverImageUrl] : undefined
  return {
    title: input.title,
    description,
    openGraph: {
      title: input.title,
      description,
      url: input.url,
      type: "article",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description,
      ...(images ? { images } : {}),
    },
  }
}
