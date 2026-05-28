import { describe, it, expect } from "vitest"
import { isPrefetchRequest } from "./prefetch"

const headers = (map: Record<string, string>) => ({ get: (n: string) => map[n.toLowerCase()] ?? null })

describe("isPrefetchRequest", () => {
  it("vrai sur Next-Router-Prefetch", () => {
    expect(isPrefetchRequest(headers({ "next-router-prefetch": "1" }))).toBe(true)
  })
  it("vrai sur Sec-Purpose: prefetch", () => {
    expect(isPrefetchRequest(headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true)
  })
  it("vrai sur Purpose: prefetch", () => {
    expect(isPrefetchRequest(headers({ purpose: "prefetch" }))).toBe(true)
  })
  it("faux sur une requête normale", () => {
    expect(isPrefetchRequest(headers({}))).toBe(false)
  })
})
