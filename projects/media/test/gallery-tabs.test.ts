import { describe, it, expect } from "vitest";
import { resolveTab } from "@/app/(admin)/gallery/new/tabs";

describe("resolveTab", () => {
  it("retourne l'onglet quand il est connu", () => {
    expect(resolveTab("upload")).toBe("upload");
    expect(resolveTab("generate")).toBe("generate");
    expect(resolveTab("pdf")).toBe("pdf");
  });
  it("retombe sur 'upload' pour une valeur inconnue", () => {
    expect(resolveTab("bogus")).toBe("upload");
  });
  it("retombe sur 'upload' quand absent", () => {
    expect(resolveTab(undefined)).toBe("upload");
  });
});
