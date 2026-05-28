import { describe, it, expect } from "vitest"
import { extractToc, extractSections } from "./toc"

describe("extractToc", () => {
  it("extrait h2 et h3 avec ancres", () => {
    const toc = extractToc("# Titre\n\n## Contexte\n\ntexte\n\n### Détail\n\n## Objectifs")
    expect(toc).toEqual([
      { depth: 2, text: "Contexte", id: "contexte" },
      { depth: 3, text: "Détail", id: "détail" },
      { depth: 2, text: "Objectifs", id: "objectifs" },
    ])
  })

  it("ignore le h1 et le contenu non-titre", () => {
    expect(extractToc("# H1\n\ndu texte\n- liste")).toEqual([])
  })

  it("désambiguïse les ancres dupliquées", () => {
    const toc = extractToc("## Intro\n\n## Intro")
    expect(toc.map((t) => t.id)).toEqual(["intro", "intro-1"])
  })

  it("ignore un # dans un bloc de code", () => {
    expect(extractToc("```\n## pas un titre\n```")).toEqual([])
  })
})

describe("extractSections", () => {
  it("aplatit plusieurs markdown en sections (ancres = extractToc)", () => {
    expect(extractSections(["## Contexte\n\n### Détail", "## Objectifs"])).toEqual([
      { title: "Contexte", depth: 2, anchor: "contexte" },
      { title: "Détail", depth: 3, anchor: "détail" },
      { title: "Objectifs", depth: 2, anchor: "objectifs" },
    ])
  })
  it("ignore les textes sans titre h2/h3", () => {
    expect(extractSections(["# H1\n\ntexte", "## Ok"])).toEqual([{ title: "Ok", depth: 2, anchor: "ok" }])
  })
})
