import { PDFDocument } from 'pdf-lib';
import { createPdfCarousel } from '@/lib/db/repositories/carousels';
import { updatePost } from '@/lib/db/repositories/posts';
import { validatePdfFile } from '@/lib/media/validate-upload';
import { getMediaEngine } from '@/lib/media-engine';

// %PDF en tête de fichier : on ne se fie pas qu'au type MIME déclaré.
function isPdf(bytes: Buffer): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

// Upload d'un PDF déjà prêt comme carrousel (document LinkedIn). Pas de slides
// images : l'aperçu page par page sera ajouté plus tard.
export async function uploadCarouselPdfCore(
  userId: string,
  file: File,
  opts: { postId?: string } = {},
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const v = validatePdfFile({ type: file.type, size: file.size });
  if (!v.ok) return { status: 'error', message: v.message };

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!isPdf(bytes)) return { status: 'error', message: 'Fichier PDF invalide.' };

  let width = 0;
  let height = 0;
  try {
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() < 1) return { status: 'error', message: 'PDF sans page.' };
    const size = pdf.getPage(0).getSize();
    width = Math.round(size.width);
    height = Math.round(size.height);
  } catch {
    return { status: 'error', message: 'PDF illisible.' };
  }

  const obj = await getMediaEngine().upload({ bytes, contentType: 'application/pdf' });

  const carousel = await createPdfCarousel(userId, { assetKey: obj.url, width, height });
  if (opts.postId) await updatePost(userId, opts.postId, { mediaId: carousel.id });
  return { status: 'success', mediaId: carousel.id };
}
