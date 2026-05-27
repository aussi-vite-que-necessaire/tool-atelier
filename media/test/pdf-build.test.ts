import { describe, it, expect } from "vitest";
import { buildPdf } from "@/lib/pdf/build";
import { PDFDocument } from "pdf-lib";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("buildPdf", () => {
  it("rejette une liste vide", async () => {
    await expect(buildPdf([])).rejects.toThrow();
  });
  it("produit un PDF avec une page par image", async () => {
    const out = await buildPdf(
      [{ bytes: PNG_1x1, type: "image/png" }, { bytes: PNG_1x1, type: "image/png" }],
      { width: 100, height: 100 },
    );
    expect(out.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });
  it("rejette un format non supporté (WebP)", async () => {
    await expect(
      buildPdf([{ bytes: Buffer.from("RIFFxxxxWEBP"), type: "image/webp" }], { width: 10, height: 10 }),
    ).rejects.toThrow();
  });
});
