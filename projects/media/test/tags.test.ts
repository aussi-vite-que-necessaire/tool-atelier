import { describe, it, expect } from "vitest";
import { parseTags, serializeTags, hasAllTags, clampLimit } from "../src/lib/tags";

describe("parseTags", () => {
  it("parse un JSON array de strings", () => {
    expect(parseTags('["a","b"]')).toEqual(["a", "b"]);
  });
  it("retourne [] pour null/vide/JSON invalide", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("{pas du json")).toEqual([]);
  });
  it("filtre les éléments non-string", () => {
    expect(parseTags('["a",1,null,"b"]')).toEqual(["a", "b"]);
  });
});

describe("serializeTags", () => {
  it("sérialise et gère null", () => {
    expect(serializeTags(["x"])).toBe('["x"]');
    expect(serializeTags(null)).toBe("[]");
  });
});

describe("hasAllTags", () => {
  it("exige toutes les tags (intersection)", () => {
    expect(hasAllTags(["a", "b", "c"], ["a", "c"])).toBe(true);
    expect(hasAllTags(["a", "b"], ["a", "z"])).toBe(false);
    expect(hasAllTags(["a"], [])).toBe(true);
  });
});

describe("clampLimit", () => {
  it("applique défaut et plafond", () => {
    expect(clampLimit(undefined)).toBe(20);
    expect(clampLimit(0)).toBe(20);
    expect(clampLimit(-5)).toBe(20);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(1000)).toBe(100);
    expect(clampLimit(10.9)).toBe(10);
  });
});
