import { describe, it, expect } from "vitest"
import { planPages } from "./plan"

describe("planPages", () => {
  it("place la racine en premier (parent null, slug vide)", () => {
    const plan = planPages("Intro", [], [])
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ parentTempId: null, slug: "", title: "Intro", position: 0 })
  })

  it("aplatit les sous-pages avec parent et position", () => {
    const plan = planPages("Intro", [], [
      { slug: "a", title: "A", children: [{ slug: "a1", title: "A1" }] },
      { slug: "b", title: "B" },
    ])
    const root = plan[0]
    const a = plan.find((p) => p.slug === "a")!
    const a1 = plan.find((p) => p.slug === "a1")!
    const b = plan.find((p) => p.slug === "b")!
    expect(a.parentTempId).toBe(root.tempId)
    expect(a.position).toBe(0)
    expect(b.position).toBe(1)
    expect(a1.parentTempId).toBe(a.tempId)
  })

  it("attache les modules aux pages", () => {
    const plan = planPages("Intro", [{ type: "markdown", content: { md: "x" } }], [])
    expect(plan[0].modules).toHaveLength(1)
  })
})
