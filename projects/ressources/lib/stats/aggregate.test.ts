import { describe, it, expect } from "vitest"
import { aggregateResourceStats, aggregateBySource } from "./aggregate"

const pages = [
  { id: "root", title: "Intro", path: [] as string[] },
  { id: "p1", title: "Prompting", path: ["prompting"] },
]

describe("aggregateResourceStats", () => {
  it("compte vues totales, uniques, gate et par page", () => {
    const events = [
      { pageId: "root", userId: "u1", type: "page_view" as const },
      { pageId: "root", userId: "u1", type: "page_view" as const },
      { pageId: "p1", userId: "u2", type: "page_view" as const },
      { pageId: null, userId: null, type: "gate_view" as const },
      { pageId: null, userId: "u3", type: "gate_view" as const },
    ]
    const stats = aggregateResourceStats(events, pages)
    expect(stats.totalPageViews).toBe(3)
    expect(stats.uniqueViewers).toBe(2)
    expect(stats.gateImpressions).toBe(2)
    expect(stats.perPage).toEqual([
      { pageId: "root", title: "Intro", path: [], views: 2 },
      { pageId: "p1", title: "Prompting", path: ["prompting"], views: 1 },
    ])
  })

  it("renvoie zéro partout sans événements", () => {
    const stats = aggregateResourceStats([], pages)
    expect(stats.totalPageViews).toBe(0)
    expect(stats.uniqueViewers).toBe(0)
    expect(stats.gateImpressions).toBe(0)
    expect(stats.perPage.every((p) => p.views === 0)).toBe(true)
  })
})

describe("aggregateBySource", () => {
  const events = [
    { pageId: "root", userId: "u1", type: "page_view" as const, source: "linkedin", campaign: "post-a" },
    { pageId: "p1", userId: "u1", type: "page_view" as const, source: "linkedin", campaign: "post-a" },
    { pageId: null, userId: null, type: "gate_view" as const, source: "linkedin", campaign: "post-b" },
    { pageId: "root", userId: "u2", type: "page_view" as const, source: "newsletter", campaign: null },
    { pageId: "root", userId: "u3", type: "page_view" as const, source: null, campaign: null },
  ]
  const subs = [
    { userId: "u1", source: "linkedin", campaign: "post-a" },
    { userId: "u2", source: "newsletter", campaign: null },
    { userId: "u4", source: "linkedin", campaign: "post-b" },
  ]

  it("ventile vues, impressions gate et utilisateurs gagnés par source", () => {
    const rows = aggregateBySource(events, subs)
    const linkedin = rows.find((r) => r.source === "linkedin")!
    expect(linkedin.pageViews).toBe(2)
    expect(linkedin.gateImpressions).toBe(1)
    expect(linkedin.users).toBe(2) // u1 + u4
    const newsletter = rows.find((r) => r.source === "newsletter")!
    expect(newsletter.pageViews).toBe(1)
    expect(newsletter.users).toBe(1)
  })

  it("regroupe les événements sans source sous « (direct) »", () => {
    const rows = aggregateBySource(events, subs)
    expect(rows.find((r) => r.source === "(direct)")!.pageViews).toBe(1)
  })

  it("trie par utilisateurs gagnés décroissant", () => {
    const rows = aggregateBySource(events, subs)
    expect(rows[0].source).toBe("linkedin")
  })
})
