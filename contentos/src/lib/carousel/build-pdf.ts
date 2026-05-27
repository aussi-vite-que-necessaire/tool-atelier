import { PDFDocument } from 'pdf-lib';

export type CarouselSlide = { bytes: Buffer; type: string };

// Détecte le format réel d'après les magic bytes : ne pas se fier à l'extension,
// une image peut être stockée en .png tout en contenant du JPEG.
function sniffFormat(bytes: Buffer): 'png' | 'jpeg' | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  return null;
}

// Assemble des images (toutes au même format d'affichage) en un PDF : une image
// par page, dimensionnée au format donné, dessinée plein cadre. C'est le format
// "document" que LinkedIn rend en carrousel swipeable. pdf-lib n'embarque que
// PNG et JPEG → les autres formats (ex. WebP) sont rejetés explicitement.
export async function buildCarouselPdf(
  slides: CarouselSlide[],
  size: { width: number; height: number },
): Promise<Buffer> {
  if (slides.length === 0) throw new Error('Carrousel vide : au moins une slide requise');

  const pdf = await PDFDocument.create();
  for (const slide of slides) {
    const fmt = sniffFormat(slide.bytes);
    if (!fmt) {
      throw new Error('Format de slide non supporté pour le carrousel (PNG ou JPEG uniquement).');
    }
    const bytes = new Uint8Array(slide.bytes);
    const img = fmt === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([size.width, size.height]);
    page.drawImage(img, { x: 0, y: 0, width: size.width, height: size.height });
  }
  const out = await pdf.save();
  return Buffer.from(out);
}
