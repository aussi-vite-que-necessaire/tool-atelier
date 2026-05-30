import { PDFDocument } from 'pdf-lib';
import { parseImageDimensions } from './image-meta';
import { getMediaRecord } from './repository';
import { getImageBytes } from './storage';
import { store } from './store';
import type { MediaRecord } from './types';

export type PdfImage = { bytes: Buffer; type: string };

// Détecte le format réel d'après les magic bytes : ne pas se fier au type MIME
// déclaré, une image peut être stockée sous un mime trompeur.
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

// Assemble des images en un PDF : une image par page, dessinée plein cadre.
// pdf-lib ne supporte que PNG et JPEG → les autres formats sont rejetés.
export async function buildPdf(
  images: PdfImage[],
  size?: { width: number; height: number },
): Promise<Buffer> {
  if (images.length === 0) throw new Error("Liste d'images vide : au moins une image requise");

  const pdf = await PDFDocument.create();
  for (const image of images) {
    const fmt = sniffFormat(image.bytes);
    if (!fmt) {
      throw new Error(
        `Format non supporté pour le PDF (PNG ou JPEG uniquement). Type déclaré : ${image.type}`,
      );
    }
    const uint = new Uint8Array(image.bytes);
    const img = fmt === 'png' ? await pdf.embedPng(uint) : await pdf.embedJpg(uint);

    let pageWidth: number;
    let pageHeight: number;
    if (size) {
      pageWidth = size.width;
      pageHeight = size.height;
    } else {
      const dims = parseImageDimensions(uint);
      pageWidth = dims?.width ?? img.width;
      pageHeight = dims?.height ?? img.height;
    }

    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(img, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const out = await pdf.save();
  return Buffer.from(out);
}

// Agrège une liste ordonnée d'images (par id) en un PDF (une image par page).
// `tags` est appliqué au média PDF produit (pour le retrouver dans la galerie).
export async function aggregatePdf(
  userId: string,
  imageIds: string[],
  tags: string[] = [],
): Promise<MediaRecord> {
  if (imageIds.length === 0) throw new Error('Au moins une image requise');

  const images: PdfImage[] = [];

  for (const id of imageIds) {
    const rec = await getMediaRecord(userId, id);
    if (!rec) throw new Error(`Image introuvable: ${id}`);
    if (rec.kind !== 'image') {
      throw new Error(`L'objet ${id} n'est pas une image`);
    }
    const got = await getImageBytes(rec.r2_key);
    if (!got) throw new Error(`Octets absents pour ${id}`);
    images.push({ bytes: Buffer.from(got.bytes), type: got.contentType });
  }

  const pdf = await buildPdf(images);

  return store({
    userId,
    bytes: new Uint8Array(pdf),
    mimeType: 'application/pdf',
    kind: 'pdf',
    prompt: null,
    parent_id: null,
    source: 'pdf_aggregate',
    tags,
  });
}
