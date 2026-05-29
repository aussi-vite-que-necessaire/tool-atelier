import type { ModuleInput } from "./module-input"

export type PageInput = {
  slug: string
  title: string
  modules?: ModuleInput[]
  children?: PageInput[]
}

export type PlannedPage = {
  tempId: string
  parentTempId: string | null
  slug: string
  title: string
  position: number
  modules: ModuleInput[]
}

export function planPages(rootTitle: string, rootModules: ModuleInput[], pages: PageInput[]): PlannedPage[] {
  const out: PlannedPage[] = []
  let counter = 0
  const nextId = () => `t${counter++}`

  const rootId = nextId()
  out.push({ tempId: rootId, parentTempId: null, slug: "", title: rootTitle, position: 0, modules: rootModules })

  const walk = (nodes: PageInput[], parentTempId: string) => {
    nodes.forEach((node, i) => {
      const id = nextId()
      out.push({
        tempId: id,
        parentTempId,
        slug: node.slug,
        title: node.title,
        position: i,
        modules: node.modules ?? [],
      })
      if (node.children?.length) walk(node.children, id)
    })
  }
  walk(pages, rootId)
  return out
}
