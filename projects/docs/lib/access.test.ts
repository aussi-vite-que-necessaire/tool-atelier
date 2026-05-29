import { describe, it, expect } from "vitest"
import { normalizeEmail, canAccess } from "./access"

const pub = { published: true, visibility: "public" }
const priv = { published: true, visibility: "private" }

describe("normalizeEmail", () => {
  it("trim + minuscules", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com")
  })
  it("idempotent", () => {
    expect(normalizeEmail(normalizeEmail("A@B.C"))).toBe("a@b.c")
  })
})

describe("canAccess", () => {
  it("non-publiée → false même connecté", () => {
    expect(canAccess({ published: false, visibility: "public" }, "a@b.c", [])).toBe(false)
  })
  it("anonyme → false", () => {
    expect(canAccess(pub, null, [])).toBe(false)
  })
  it("publique + connecté → true", () => {
    expect(canAccess(pub, "a@b.c", [])).toBe(true)
  })
  it("privée + email attribué → true (insensible à la casse)", () => {
    expect(canAccess(priv, "Client@Exemple.com", ["client@exemple.com"])).toBe(true)
  })
  it("privée + email non attribué → false", () => {
    expect(canAccess(priv, "autre@exemple.com", ["client@exemple.com"])).toBe(false)
  })
})
