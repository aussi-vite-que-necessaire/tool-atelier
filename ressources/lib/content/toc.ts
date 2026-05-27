import GithubSlugger from "github-slugger"

export type TocItem = { depth: 2 | 3; text: string; id: string }

export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let inFence = false

  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const depth = m[1].length as 2 | 3
    const text = m[2].trim()
    items.push({ depth, text, id: slugger.slug(text) })
  }
  return items
}

export type Section = { title: string; depth: 2 | 3; anchor: string }

export function extractSections(mdTexts: string[]): Section[] {
  return mdTexts.flatMap((md) => extractToc(md)).map((t) => ({ title: t.text, depth: t.depth, anchor: t.id }))
}
