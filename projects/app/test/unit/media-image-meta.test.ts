import { describe, expect, it } from 'vitest';
import { extensionForMime, mimeForFormat, parseImageDimensions } from '@/lib/media/image-meta';

function makePng(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8);
  b[16] = (width >>> 24) & 0xff;
  b[17] = (width >>> 16) & 0xff;
  b[18] = (width >>> 8) & 0xff;
  b[19] = width & 0xff;
  b[20] = (height >>> 24) & 0xff;
  b[21] = (height >>> 16) & 0xff;
  b[22] = (height >>> 8) & 0xff;
  b[23] = height & 0xff;
  return b;
}

function makeJpeg(width: number, height: number): Uint8Array {
  const b = new Uint8Array(20);
  b[0] = 0xff;
  b[1] = 0xd8; // SOI
  b[2] = 0xff;
  b[3] = 0xc0; // SOF0
  b[4] = 0x00;
  b[5] = 0x11; // longueur segment
  b[6] = 0x08; // précision
  b[7] = (height >>> 8) & 0xff;
  b[8] = height & 0xff;
  b[9] = (width >>> 8) & 0xff;
  b[10] = width & 0xff;
  return b;
}

describe('parseImageDimensions', () => {
  it("lit les dimensions d'un PNG", () => {
    expect(parseImageDimensions(makePng(1344, 768))).toEqual({ width: 1344, height: 768 });
  });

  it("lit les dimensions d'un JPEG (SOF0)", () => {
    expect(parseImageDimensions(makeJpeg(200, 100))).toEqual({ width: 200, height: 100 });
  });

  it('retourne null pour un format inconnu', () => {
    expect(parseImageDimensions(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('extensionForMime', () => {
  it('mappe les mimes connus', () => {
    expect(extensionForMime('image/png')).toBe('png');
    expect(extensionForMime('image/jpeg')).toBe('jpg');
    expect(extensionForMime('image/webp')).toBe('webp');
  });

  it('retombe sur png par défaut', () => {
    expect(extensionForMime(null)).toBe('png');
    expect(extensionForMime('application/octet-stream')).toBe('png');
  });
});

describe('mimeForFormat', () => {
  it('mappe format → mime', () => {
    expect(mimeForFormat('png')).toBe('image/png');
    expect(mimeForFormat('webp')).toBe('image/webp');
    expect(mimeForFormat('jpeg')).toBe('image/jpeg');
  });
});
