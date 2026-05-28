import { describe, it, expect } from "vitest"
import { parseModule, moduleContentSchemas } from "./schemas"

describe("parseModule", () => {
  it("valide un module markdown", () => {
    const m = parseModule({ id: "1", type: "markdown", position: 0, content: { md: "# Hi" } })
    expect(m).toEqual({ id: "1", type: "markdown", position: 0, content: { md: "# Hi" } })
  })

  it("valide un callout avec variant", () => {
    const m = parseModule({ id: "2", type: "callout", position: 1, content: { variant: "info", md: "x" } })
    expect(m?.type).toBe("callout")
  })

  it("valide image / video / file / embed", () => {
    expect(parseModule({ id: "a", type: "image", position: 0, content: { url: "https://r2.example/x.png" } })).not.toBeNull()
    expect(parseModule({ id: "b", type: "video", position: 0, content: { url: "https://r2.example/x.mp4" } })).not.toBeNull()
    expect(
      parseModule({ id: "c", type: "file", position: 0, content: { url: "https://r2.example/x.zip", label: "DL", filename: "x.zip" } }),
    ).not.toBeNull()
    expect(parseModule({ id: "d", type: "embed", position: 0, content: { url: "https://youtu.be/x" } })).not.toBeNull()
  })

  it("renvoie null pour un type inconnu", () => {
    expect(parseModule({ id: "x", type: "wat", position: 0, content: {} })).toBeNull()
  })

  it("renvoie null si content invalide", () => {
    expect(parseModule({ id: "y", type: "markdown", position: 0, content: { nope: 1 } })).toBeNull()
    expect(parseModule({ id: "z", type: "callout", position: 0, content: { variant: "danger", md: "x" } })).toBeNull()
  })

  it("expose un schéma par type", () => {
    expect(Object.keys(moduleContentSchemas).sort()).toEqual(
      [
        "accordion", "callout", "code", "comparison", "cta", "embed", "file",
        "gallery", "image", "markdown", "prompt", "quote", "steps", "video",
      ].sort(),
    )
  })
})
