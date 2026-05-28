import { describe, it, expect } from "vitest"
import { validateModuleInput } from "./module-input"

describe("validateModuleInput", () => {
  it("accepte un markdown valide", () => {
    expect(validateModuleInput({ type: "markdown", content: { md: "# Hi" } })).toEqual({
      type: "markdown",
      content: { md: "# Hi" },
    })
  })
  it("accepte un callout valide", () => {
    expect(validateModuleInput({ type: "callout", content: { variant: "info", md: "x" } }).type).toBe("callout")
  })
  it("rejette un type inconnu", () => {
    expect(() => validateModuleInput({ type: "wat", content: {} })).toThrow()
  })
  it("rejette un content invalide", () => {
    expect(() => validateModuleInput({ type: "image", content: { url: "pas-une-url" } })).toThrow()
  })

  it("accepte les nouveaux types (lot 9)", () => {
    expect(validateModuleInput({ type: "code", content: { language: "ts", code: "const a=1" } }).type).toBe("code")
    expect(validateModuleInput({ type: "prompt", content: { prompt: "Fais X" } }).type).toBe("prompt")
    expect(validateModuleInput({ type: "accordion", content: { title: "T", md: "x" } }).type).toBe("accordion")
    expect(validateModuleInput({ type: "steps", content: { steps: [{ title: "S1", md: "x" }] } }).type).toBe("steps")
    expect(
      validateModuleInput({ type: "comparison", content: { columns: [{ title: "A", md: "x" }, { title: "B", md: "y" }] } }).type,
    ).toBe("comparison")
    expect(validateModuleInput({ type: "quote", content: { text: "citation" } }).type).toBe("quote")
    expect(validateModuleInput({ type: "cta", content: { label: "Go", url: "https://x.co" } }).type).toBe("cta")
    expect(validateModuleInput({ type: "gallery", content: { images: [{ url: "https://x.co/a.png" }] } }).type).toBe("gallery")
  })

  it("rejette les contenus invalides des nouveaux types", () => {
    expect(() => validateModuleInput({ type: "code", content: { code: "x" } })).toThrow()
    expect(() => validateModuleInput({ type: "comparison", content: { columns: [{ title: "A", md: "x" }] } })).toThrow()
    expect(() => validateModuleInput({ type: "cta", content: { label: "Go", url: "pas-url" } })).toThrow()
  })
})
