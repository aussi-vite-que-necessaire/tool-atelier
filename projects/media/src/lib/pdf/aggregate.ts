import { getMediaRecord } from "@/lib/media/repository";
import { getImageBytes } from "@/lib/storage";
import { buildPdf, type PdfImage } from "./build";
import { store } from "@/lib/store";
import type { MediaRecord } from "@/lib/media/types";

// Agrège une liste ordonnée d'images (par id) en un PDF (une image par page).
// `tags` est appliqué au média PDF produit (pour le retrouver dans la galerie).
export async function aggregatePdf(imageIds: string[], tags: string[] = []): Promise<MediaRecord> {
  if (imageIds.length === 0) throw new Error("Au moins une image requise");

  const images: PdfImage[] = [];

  for (const id of imageIds) {
    const rec = await getMediaRecord(id);
    if (!rec) throw new Error(`Image introuvable: ${id}`);
    if (rec.kind !== "image" && rec.kind !== "render") {
      throw new Error(`L'objet ${id} n'est pas une image`);
    }
    const got = await getImageBytes(rec.r2_key);
    if (!got) throw new Error(`Octets absents pour ${id}`);
    images.push({ bytes: Buffer.from(got.bytes), type: got.contentType });
  }

  // Pas de taille forcée : chaque page épouse les dimensions de son image (pas
  // d'étirement si les images diffèrent). buildPdf déduit la taille par image.
  const pdf = await buildPdf(images);

  return store({
    bytes: new Uint8Array(pdf),
    mimeType: "application/pdf",
    kind: "pdf",
    prompt: null,
    parent_id: null,
    source: "pdf_aggregate",
    tags,
  });
}
