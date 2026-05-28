import { describe, it, expect } from "vitest"
import { parseRefFromParams, parseRefFromRecord, serializeRefCookie, parseRefCookie, buildTrackingUrl, type Ref } from "./ref"

const params = (q: string) => new URLSearchParams(q)

describe("parseRefFromParams", () => {
  it("lit le trio UTM et normalise (trim, minuscules, longueur)", () => {
    expect(parseRefFromParams(params("utm_source=LinkedIn&utm_medium=Social&utm_campaign=Post-Auto"))).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "post-auto",
    })
  })

  it("accepte src comme alias de utm_source", () => {
    expect(parseRefFromParams(params("src=Newsletter"))).toEqual({ source: "newsletter", medium: null, campaign: null })
  })

  it("préfère utm_source à src si les deux sont présents", () => {
    expect(parseRefFromParams(params("utm_source=linkedin&src=ignored"))?.source).toBe("linkedin")
  })

  it("plafonne la longueur à 64 caractères", () => {
    const long = "a".repeat(100)
    expect(parseRefFromParams(params(`utm_source=${long}`))?.source).toHaveLength(64)
  })

  it("renvoie null si aucun paramètre exploitable", () => {
    expect(parseRefFromParams(params("foo=bar"))).toBeNull()
    expect(parseRefFromParams(params("utm_source=%20%20"))).toBeNull()
  })

  it("renvoie un ref même si seuls medium/campaign sont posés sans source", () => {
    expect(parseRefFromParams(params("utm_campaign=mai"))).toEqual({ source: null, medium: null, campaign: "mai" })
  })
})

describe("parseRefFromRecord", () => {
  it("lit un record searchParams Next (string)", () => {
    expect(parseRefFromRecord({ utm_source: "linkedin", utm_campaign: "post-a" })).toEqual({
      source: "linkedin",
      medium: null,
      campaign: "post-a",
    })
  })

  it("prend la première valeur si tableau et ignore undefined", () => {
    expect(parseRefFromRecord({ utm_source: ["twitter", "x"], preview: undefined })?.source).toBe("twitter")
  })

  it("renvoie null sur record vide ou absent", () => {
    expect(parseRefFromRecord({})).toBeNull()
    expect(parseRefFromRecord(undefined)).toBeNull()
  })
})

describe("buildTrackingUrl", () => {
  const base = "https://ressources.avqn.ch/r/guide-ia"

  it("ajoute les trois paramètres UTM", () => {
    expect(buildTrackingUrl(base, { source: "linkedin", medium: "social", campaign: "post-auto" })).toBe(
      "https://ressources.avqn.ch/r/guide-ia?utm_source=linkedin&utm_medium=social&utm_campaign=post-auto",
    )
  })

  it("n'ajoute que source si medium/campaign absents", () => {
    expect(buildTrackingUrl(base, { source: "newsletter" })).toBe(
      "https://ressources.avqn.ch/r/guide-ia?utm_source=newsletter",
    )
  })

  it("normalise les valeurs (casse, trim, longueur) comme la capture", () => {
    const url = buildTrackingUrl(base, { source: "  LinkedIn  ", campaign: "A".repeat(100) })
    expect(url).toContain("utm_source=linkedin")
    const campaign = new URL(url).searchParams.get("utm_campaign")!
    expect(campaign).toBe("a".repeat(64))
  })

  it("le lien généré se reparse en la même attribution (round-trip)", () => {
    const url = buildTrackingUrl(base, { source: "LinkedIn", medium: "Social", campaign: "Post-Auto" })
    expect(parseRefFromParams(new URL(url).searchParams)).toEqual({
      source: "linkedin",
      medium: "social",
      campaign: "post-auto",
    })
  })

  it("préserve un chemin de sous-page dans la base", () => {
    const url = buildTrackingUrl("https://ressources.avqn.ch/r/guide-ia/prompting", { source: "twitter" })
    expect(url).toBe("https://ressources.avqn.ch/r/guide-ia/prompting?utm_source=twitter")
  })
})

describe("cookie aller-retour", () => {
  it("sérialise puis reparse à l'identique", () => {
    const ref: Ref = { source: "linkedin", medium: "social", campaign: "post-auto" }
    const parsed = parseRefCookie(serializeRefCookie(ref))
    expect(parsed).toEqual(ref)
  })

  it("parseRefCookie tolère une valeur absente ou invalide", () => {
    expect(parseRefCookie(undefined)).toBeNull()
    expect(parseRefCookie("pas-du-json")).toBeNull()
  })
})
