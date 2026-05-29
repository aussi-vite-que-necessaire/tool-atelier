import { describe, it, expect } from "vitest"
import { parseSettingsInput } from "./validate"

describe("parseSettingsInput", () => {
  it("accepte un nom de marque et une config valides", () => {
    const r = parseSettingsInput({
      brandName: "Atelier de Manu",
      theme: { preset: "modern", overrides: { accent: "#5b21b6" } },
    })
    expect(r).not.toBeNull()
    expect(r!.brandName).toBe("Atelier de Manu")
    expect(r!.theme.preset).toBe("modern")
    expect(r!.theme.overrides.accent).toBe("#5b21b6")
  })

  it("normalise un nom de marque vide en null", () => {
    const r = parseSettingsInput({ brandName: "   ", theme: { preset: "brutalist", overrides: {} } })
    expect(r!.brandName).toBeNull()
  })

  it("rejette un override de couleur dangereux", () => {
    const r = parseSettingsInput({
      brandName: "x",
      theme: { preset: "brutalist", overrides: { accent: "red; } body{}" } },
    })
    expect(r).toBeNull()
  })

  it("rejette une police hors allowlist", () => {
    const r = parseSettingsInput({
      brandName: "x",
      theme: { preset: "brutalist", overrides: { fontSans: "Comic Sans MS" } },
    })
    expect(r).toBeNull()
  })
})
