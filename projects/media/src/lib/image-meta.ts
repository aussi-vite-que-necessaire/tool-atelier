// Lecture des dimensions d'une image directement dans ses octets (PNG, JPEG)
// et correspondance mime → extension. Logique pure, sans dépendance runtime.

export interface Dimensions {
  width: number;
  height: number;
}

export type RenderFormat = "png" | "webp" | "jpeg";

export function mimeForFormat(format: RenderFormat): string {
  switch (format) {
    case "webp":
      return "image/webp";
    case "jpeg":
      return "image/jpeg";
    default:
      return "image/png";
  }
}

export function extensionForMime(mime: string | null | undefined): string {
  switch ((mime ?? "").toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "application/pdf":
      return "pdf";
    default:
      return "png";
  }
}

export function parseImageDimensions(bytes: Uint8Array): Dimensions | null {
  if (isPng(bytes)) return parsePng(bytes);
  if (isJpeg(bytes)) return parseJpeg(bytes);
  return null;
}

function u16(b: Uint8Array, off: number): number {
  return (b[off] << 8) | b[off + 1];
}

function u32(b: Uint8Array, off: number): number {
  return (b[off] * 0x1000000) + (b[off + 1] << 16) + (b[off + 2] << 8) + b[off + 3];
}

function isPng(b: Uint8Array): boolean {
  return (
    b.length >= 24 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  );
}

function parsePng(b: Uint8Array): Dimensions {
  // IHDR : largeur (uint32 BE) à l'offset 16, hauteur à l'offset 20.
  return { width: u32(b, 16), height: u32(b, 20) };
}

function isJpeg(b: Uint8Array): boolean {
  return b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
}

function parseJpeg(b: Uint8Array): Dimensions | null {
  let off = 2;
  while (off + 9 < b.length) {
    if (b[off] !== 0xff) {
      off++;
      continue;
    }
    const marker = b[off + 1];
    // Marqueurs SOF (Start Of Frame) qui portent les dimensions ;
    // on exclut C4 (DHT), C8 (JPG), CC (DAC) qui n'en portent pas.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16(b, off + 5);
      const width = u16(b, off + 7);
      return { width, height };
    }
    const segLen = u16(b, off + 2);
    if (segLen < 2) return null;
    off += 2 + segLen;
  }
  return null;
}
