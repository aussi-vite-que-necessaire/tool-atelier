import { describe, it, expect } from "vitest"
import { hasManualMarker, loginRedirect } from "./preview"

describe("hasManualMarker", () => {
  it("détecte le marqueur", () => {
    expect(hasManualMarker("a=1; cos_preview_login=manual; b=2")).toBe(true)
  })
  it("absent quand pas de cookie", () => {
    expect(hasManualMarker(null)).toBe(false)
    expect(hasManualMarker("foo=bar")).toBe(false)
  })
})

describe("loginRedirect", () => {
  const base = {
    authUrl: "https://auth-x.preview.contentos.ch",
    back: "https://app-x.preview.contentos.ch/admin",
    defaultUser: 1 as const,
  }
  it("prod → /sign-in", () => {
    expect(loginRedirect({ ...base, preview: false, cookieHeader: null })).toBe(
      `https://auth-x.preview.contentos.ch/sign-in?redirect=${encodeURIComponent(base.back)}`,
    )
  })
  it("preview sans marqueur → auto-login user défaut", () => {
    expect(loginRedirect({ ...base, preview: true, cookieHeader: null })).toBe(
      `https://auth-x.preview.contentos.ch/preview-login?user=1&redirect=${encodeURIComponent(base.back)}`,
    )
  })
  it("preview avec marqueur → chooser", () => {
    expect(loginRedirect({ ...base, preview: true, cookieHeader: "cos_preview_login=manual" })).toBe(
      `https://auth-x.preview.contentos.ch/sign-in?redirect=${encodeURIComponent(base.back)}`,
    )
  })
})
