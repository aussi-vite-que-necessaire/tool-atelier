import { Markdown } from "@/components/reader/markdown"

export function MarkdownModule({ md }: { md: string }) {
  return <Markdown>{md}</Markdown>
}
