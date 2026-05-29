import { describe, it, expect } from "vitest"
import { buildPageTree, type TreePage } from "./tree"

const rows = [
  { id: "root", parentId: null, slug: "", title: "Racine", position: 0 },
  { id: "b", parentId: "root", slug: "b", title: "B", position: 1 },
  { id: "a", parentId: "root", slug: "a", title: "A", position: 0 },
  { id: "a1", parentId: "a", slug: "a1", title: "A1", position: 0 },
]

describe("buildPageTree", () => {
  it("retourne la page racine (parentId null)", () => {
    expect(buildPageTree(rows)?.id).toBe("root")
  })

  it("trie les enfants par position", () => {
    const tree = buildPageTree(rows) as TreePage
    expect(tree.children.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("imbrique les sous-pages", () => {
    const tree = buildPageTree(rows) as TreePage
    expect(tree.children[0].children[0].id).toBe("a1")
  })

  it("retourne null si aucune racine", () => {
    expect(buildPageTree([{ id: "x", parentId: "y", slug: "x", title: "X", position: 0 }])).toBeNull()
  })
})
