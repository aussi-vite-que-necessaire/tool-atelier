import { describe, it, expect } from "vitest"
import { resolveTheme, themeToCss } from "./resolve"
import { PRESETS } from "./presets"

describe("resolveTheme", () => {
  it("résout un preset seul", () => {
    expect(resolveTheme({ preset: "modern", overrides: {} })).toEqual(PRESETS.modern)
  })

  it("applique des overrides partiels par-dessus le preset", () => {
    const r = resolveTheme({ preset: "brutalist", overrides: { accent: "#ff0000" } })
    expect(r.accent).toBe("#ff0000")
    expect(r.paper).toBe(PRESETS.brutalist.paper)
  })

  it("retombe sur le défaut (brutalist) pour un preset inconnu ou null", () => {
    expect(resolveTheme({ preset: "nope", overrides: {} })).toEqual(PRESETS.brutalist)
    expect(resolveTheme(null)).toEqual(PRESETS.brutalist)
    expect(resolveTheme(undefined)).toEqual(PRESETS.brutalist)
  })

  it("ignore des overrides invalides plutôt que de planter", () => {
    const r = resolveTheme({ preset: "brutalist", overrides: { accent: "red; } body{display:none}" } as never })
    expect(r.accent).toBe(PRESETS.brutalist.accent)
  })
})

describe("themeToCss", () => {
  it("produit les variables CSS attendues", () => {
    const css = themeToCss(PRESETS.brutalist)
    expect(css).toContain("--paper: oklch(0.985 0.005 95)")
    expect(css).toContain("--paper-2: oklch(0.955 0.008 95)")
    expect(css).toContain("--ink-soft:")
    expect(css).toContain("--accent-ink:")
    expect(css).toContain("--c-info:")
    expect(css).toContain("--radius: 0")
    expect(css).toContain("--font-sans:")
    expect(css).toContain("--font-mono:")
  })

  it("dérive les ombres dures en style brutal", () => {
    const css = themeToCss(PRESETS.brutalist)
    expect(css).toContain("--shadow-brutal: 4px 4px 0 0 var(--ink)")
    expect(css).toContain("--shadow-brutal-accent: 4px 4px 0 0 var(--accent)")
  })

  it("dérive des ombres floues en style soft", () => {
    const css = themeToCss({ ...PRESETS.modern, shadowStyle: "soft" })
    expect(css).toContain("--shadow-brutal:")
    expect(css).not.toContain("0 0 var(--ink)")
    expect(css).toContain("color-mix")
  })
})
