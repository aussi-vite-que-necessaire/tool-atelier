import { describe, it, expect } from "vitest";
import { orientationRatio } from "@/lib/media/repository";

describe("orientationRatio", () => {
  it("classe paysage/portrait/carré par ratio w/h", () => {
    expect(orientationRatio(1600, 900)).toBe("landscape");
    expect(orientationRatio(1080, 1920)).toBe("portrait");
    expect(orientationRatio(1000, 1000)).toBe("square");
    expect(orientationRatio(1000, 1040)).toBe("square"); // tolérance ±5%
  });
});
