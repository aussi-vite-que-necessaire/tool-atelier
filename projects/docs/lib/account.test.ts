import { describe, it, expect } from "vitest"
import { normalizeName, displayName } from "./account"

describe("normalizeName", () => {
  it("retire les espaces de début et de fin", () => {
    expect(normalizeName("  Manu  ")).toBe("Manu")
  })
  it("tronque à 80 caractères", () => {
    expect(normalizeName("a".repeat(100))).toHaveLength(80)
  })
  it("autorise la chaîne vide", () => {
    expect(normalizeName("   ")).toBe("")
  })
})

describe("displayName", () => {
  it("renvoie le nom quand il est présent", () => {
    expect(displayName({ name: "Manu", email: "m@x.io" })).toBe("Manu")
  })
  it("retombe sur l'email quand le nom est vide", () => {
    expect(displayName({ name: "", email: "m@x.io" })).toBe("m@x.io")
  })
  it("retombe sur l'email quand le nom est null", () => {
    expect(displayName({ name: null, email: "m@x.io" })).toBe("m@x.io")
  })
})
