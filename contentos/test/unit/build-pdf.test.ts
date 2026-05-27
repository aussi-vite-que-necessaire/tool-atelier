import { PDFDocument } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { buildCarouselPdf } from '@/lib/carousel/build-pdf';

// PNG 1×1 transparent valide.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('buildCarouselPdf', () => {
  test('2 images → PDF 2 pages au bon format', async () => {
    const pdf = await buildCarouselPdf(
      [
        { bytes: PNG, type: 'image/png' },
        { bytes: PNG, type: 'image/png' },
      ],
      { width: 1080, height: 1350 },
    );
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    const doc = await PDFDocument.load(new Uint8Array(pdf));
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(1080);
    expect(Math.round(height)).toBe(1350);
  });

  test('détecte le JPEG par les magic bytes même si type=png (extension trompeuse)', async () => {
    // En-tête JPEG minimal (SOI + APP0/JFIF) — suffit pour le sniff ; pdf-lib
    // parsera plus loin, donc on vérifie juste que le sniff route vers embedJpg
    // et n'émet pas "not a PNG".
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    await expect(
      buildCarouselPdf([{ bytes: jpegHeader, type: 'image/png' }], { width: 100, height: 100 }),
    ).rejects.not.toThrow(/PNG/i);
  });

  test('format non supporté (ni PNG ni JPEG) → erreur claire', async () => {
    const webpish = Buffer.from('RIFFxxxxWEBP', 'latin1');
    await expect(
      buildCarouselPdf([{ bytes: webpish, type: 'image/webp' }], { width: 100, height: 100 }),
    ).rejects.toThrow(/non supporté/i);
  });

  test('aucune slide → erreur', async () => {
    await expect(buildCarouselPdf([], { width: 1080, height: 1080 })).rejects.toThrow();
  });
});
