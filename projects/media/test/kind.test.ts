import { describe, it, expect } from "vitest";
import { kindForMime } from "@/lib/media/kind";

describe("kindForMime", () => {
  it("classe les images", () => {
    expect(kindForMime("image/png")).toBe("image");
    expect(kindForMime("image/jpeg")).toBe("image");
    expect(kindForMime("image/webp")).toBe("image");
  });
  it("classe les vidéos", () => {
    expect(kindForMime("video/mp4")).toBe("video");
  });
  it("classe les PDF", () => {
    expect(kindForMime("application/pdf")).toBe("pdf");
  });
  it("retombe sur image pour l'inconnu", () => {
    expect(kindForMime("application/octet-stream")).toBe("image");
  });
});
