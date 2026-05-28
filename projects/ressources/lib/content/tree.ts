export type FlatPage = { id: string; parentId: string | null; slug: string; title: string; position: number }
export type TreePage = FlatPage & { children: TreePage[] }

export function buildPageTree(pages: FlatPage[]): TreePage | null {
  const nodes = new Map<string, TreePage>()
  for (const p of pages) nodes.set(p.id, { ...p, children: [] })

  let root: TreePage | null = null
  for (const node of nodes.values()) {
    if (node.parentId === null) {
      root = node
    } else {
      nodes.get(node.parentId)?.children.push(node)
    }
  }

  const sortRec = (n: TreePage) => {
    n.children.sort((a, b) => a.position - b.position)
    n.children.forEach(sortRec)
  }
  if (root) sortRec(root)
  return root
}
