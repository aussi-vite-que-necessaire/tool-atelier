import { describe, it, expect } from "vitest"
import { hasManualMarker, loginRedirect, hasSessionCookie } from "./preview"

describe("hasSessionCookie", () => {
  it("détecte le cookie prod (.contentos.ch)", () => {
    expect(hasSessionCookie("__Secure-better-auth.session_token=abc")).toBe(true)
    expect(hasSessionCookie("better-auth.session_token=abc")).toBe(true)
  })
  it("détecte le cookie preview (préfixe distinct)", () => {
    expect(hasSessionCookie("__Secure-better-auth-preview.session_token=abc")).toBe(true)
    expect(hasSessionCookie("foo=1; better-auth-preview.session_token=abc")).toBe(true)
  })
  it("faux quand aucun token de session", () => {
    expect(hasSessionCookie(null)).toBe(false)
    expect(hasSessionCookie("cos_preview_login=manual")).toBe(false)
  })
})

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
