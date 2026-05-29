import { describe, it, expect } from "vitest"
import { buildPageTree } from "./tree"
import { resolvePageByPath, pagePath } from "./resolve"

const tree = buildPageTree([
  { id: "root", parentId: null, slug: "", title: "Racine", position: 0 },
  { id: "a", parentId: "root", slug: "a", title: "A", position: 0 },
  { id: "a1", parentId: "a", slug: "a1", title: "A1", position: 0 },
])!

describe("resolvePageByPath", () => {
  it("chemin vide → racine", () => {
    expect(resolvePageByPath(tree, [])?.id).toBe("root")
  })
  it("résout un chemin imbriqué", () => {
    expect(resolvePageByPath(tree, ["a", "a1"])?.id).toBe("a1")
  })
  it("retourne null pour un slug inconnu", () => {
    expect(resolvePageByPath(tree, ["a", "nope"])).toBeNull()
  })
})

describe("pagePath", () => {
  it("retrouve le chemin de slugs d'une page", () => {
    expect(pagePath(tree, "a1")).toEqual(["a", "a1"])
  })
  it("retourne un chemin vide pour la racine", () => {
    expect(pagePath(tree, "root")).toEqual([])
  })
})
