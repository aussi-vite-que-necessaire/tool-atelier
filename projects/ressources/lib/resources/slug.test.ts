import { describe, it, expect } from "vitest"
import { slugify, uniqueSlug } from "./slug"

describe("slugify", () => {
  it("minuscule, sans accent, tirets", () => {
    expect(slugify("Héllo Wörld !")).toBe("hello-world")
  })
  it("supprime les tirets de bord", () => {
    expect(slugify("  -- Guide IA -- ")).toBe("guide-ia")
  })
  it("chaîne sans alphanumérique → vide", () => {
    expect(slugify("!!! ???")).toBe("")
  })
})

describe("uniqueSlug", () => {
  it("renvoie la base si libre", () => {
    expect(uniqueSlug("guide", ["autre"])).toBe("guide")
  })
  it("suffixe en cas de collision", () => {
    expect(uniqueSlug("guide", ["guide"])).toBe("guide-2")
  })
  it("incrémente jusqu'au premier libre", () => {
    expect(uniqueSlug("guide", ["guide", "guide-2", "guide-3"])).toBe("guide-4")
  })
})
