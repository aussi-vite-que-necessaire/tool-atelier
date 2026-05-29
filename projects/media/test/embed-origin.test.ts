import { describe, expect, it } from "vitest";
import { isAllowedParentOrigin } from "@/lib/embed/origin";
import { toCreatedMedia } from "@/lib/embed/contract";

describe("isAllowedParentOrigin", () => {
  it("accepte cast prod", () => {
    expect(isAllowedParentOrigin("https://cast.contentos.ch")).toBe(true);
  });

  it("accepte les previews .preview.contentos.ch (un label)", () => {
    expect(isAllowedParentOrigin("https://cast-ma-branche.preview.contentos.ch")).toBe(true);
    expect(isAllowedParentOrigin("https://media-x.preview.contentos.ch")).toBe(true);
  });

  it("accepte localhost en dev", () => {
    expect(isAllowedParentOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedParentOrigin("http://localhost")).toBe(true);
    expect(isAllowedParentOrigin("http://127.0.0.1:8080")).toBe(true);
  });

  it("rejette une origine tierce", () => {
    expect(isAllowedParentOrigin("https://evil.com")).toBe(false);
    expect(isAllowedParentOrigin("https://cast.contentos.ch.evil.com")).toBe(false);
  });

  it("rejette http hors localhost", () => {
    expect(isAllowedParentOrigin("http://cast.contentos.ch")).toBe(false);
  });

  it("rejette les sous-domaines prod non-cast (hors preview)", () => {
    expect(isAllowedParentOrigin("https://media.contentos.ch")).toBe(false);
    expect(isAllowedParentOrigin("https://contentos.ch")).toBe(false);
  });

  it("rejette une URL avec path, null/undefined ou ordure", () => {
    expect(isAllowedParentOrigin("https://cast.contentos.ch/embed")).toBe(false);
    expect(isAllowedParentOrigin(null)).toBe(false);
    expect(isAllowedParentOrigin(undefined)).toBe(false);
    expect(isAllowedParentOrigin("pas-une-url")).toBe(false);
  });

  it("rejette un preview à plusieurs labels (pas de wildcard profond)", () => {
    expect(isAllowedParentOrigin("https://a.b.preview.contentos.ch")).toBe(false);
  });
});

describe("toCreatedMedia", () => {
  it("réduit un record au descripteur, dims absentes → null", () => {
    expect(
      toCreatedMedia({ id: "m1", url: "https://r2/x.png", kind: "image" }),
    ).toEqual({ id: "m1", url: "https://r2/x.png", kind: "image", width: null, height: null });
  });

  it("conserve les dims présentes", () => {
    expect(
      toCreatedMedia({ id: "m2", url: "https://r2/y.pdf", kind: "pdf", width: 1080, height: 1350 }),
    ).toEqual({ id: "m2", url: "https://r2/y.pdf", kind: "pdf", width: 1080, height: 1350 });
  });
});
