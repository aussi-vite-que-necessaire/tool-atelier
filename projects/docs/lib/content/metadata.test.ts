import { describe, it, expect } from "vitest"
import { buildResourceMetadata } from "./metadata"

describe("buildResourceMetadata", () => {
  it("titre, description, url, type article", () => {
    const m = buildResourceMetadata({ title: "Guide", description: "Desc", coverImageUrl: null, url: "https://x/r/guide" })
    expect(m.title).toBe("Guide")
    expect(m.description).toBe("Desc")
    expect(m.openGraph?.url).toBe("https://x/r/guide")
    expect((m.openGraph as { type?: string }).type).toBe("article")
    expect(m.openGraph?.images).toBeUndefined()
  })
  it("ajoute l'image et la carte twitter si cover", () => {
    const m = buildResourceMetadata({ title: "G", description: null, coverImageUrl: "https://r2/c.png", url: "https://x/r/g" })
    expect(m.openGraph?.images).toEqual(["https://r2/c.png"])
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image")
  })
})
