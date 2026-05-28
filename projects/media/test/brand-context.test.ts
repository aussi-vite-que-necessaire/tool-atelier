import { describe, it, expect } from "vitest";
import { toBrandContext, EMPTY_BRAND } from "@/lib/brand/context";

describe("toBrandContext", () => {
  it("brand vide → tout vide, signature null", () => {
    expect(toBrandContext(null)).toEqual(EMPTY_BRAND);
  });
  it("mappe les champs ; signature vide → null", () => {
    expect(
      toBrandContext({ userId: "u1", name: "AVQN", signature: "", logoUrl: null, updatedAt: new Date() }),
    ).toEqual({ name: "AVQN", signature: null, logo: "" });
  });
  it("garde une signature non vide et le logo", () => {
    expect(
      toBrandContext({ userId: "u1", name: "AVQN", signature: "— Manu", logoUrl: "https://x/l.png", updatedAt: new Date() }),
    ).toEqual({ name: "AVQN", signature: "— Manu", logo: "https://x/l.png" });
  });
});
