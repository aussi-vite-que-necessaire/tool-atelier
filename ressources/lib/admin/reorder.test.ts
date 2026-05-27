import { describe, it, expect } from "vitest"
import { moveInList } from "./reorder"

describe("moveInList", () => {
  it("monte un élément", () => {
    expect(moveInList(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"])
  })
  it("descend un élément", () => {
    expect(moveInList(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"])
  })
  it("ne monte pas le premier", () => {
    expect(moveInList(["a", "b"], "a", "up")).toEqual(["a", "b"])
  })
  it("ne descend pas le dernier", () => {
    expect(moveInList(["a", "b"], "b", "down")).toEqual(["a", "b"])
  })
  it("ignore un id absent", () => {
    expect(moveInList(["a", "b"], "x", "up")).toEqual(["a", "b"])
  })
})
