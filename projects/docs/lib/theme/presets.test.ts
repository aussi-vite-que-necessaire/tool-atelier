import { describe, it, expect } from "vitest"
import { themeTokensSchema } from "./tokens"
import { PRESETS, PRESET_LIST, DEFAULT_PRESET_ID } from "./presets"

describe("presets", () => {
  it("expose au moins brutalist, modern, dark, editorial", () => {
    for (const id of ["brutalist", "modern", "dark", "editorial"]) {
      expect(PRESETS[id]).toBeDefined()
    }
  })

  it("chaque preset valide contre themeTokensSchema", () => {
    for (const [id, tokens] of Object.entries(PRESETS)) {
      const r = themeTokensSchema.safeParse(tokens)
      expect(r.success, `preset ${id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true)
    }
  })

  it("le preset par défaut existe et PRESET_LIST couvre tous les presets", () => {
    expect(PRESETS[DEFAULT_PRESET_ID]).toBeDefined()
    expect(PRESET_LIST.map((p) => p.id).sort()).toEqual(Object.keys(PRESETS).sort())
  })
})
