const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

const MAX_BYTES = 10 * 1024 * 1024;

export type UploadExt = (typeof ALLOWED)[keyof typeof ALLOWED];

export function validateUploadFile(file: {
  type: string;
  size: number;
}): { ok: true; ext: UploadExt } | { ok: false; message: string } {
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext) return { ok: false, message: 'Format non supporté (png, jpg, webp).' };
  if (file.size > MAX_BYTES) return { ok: false, message: 'Image trop lourde (max 10 Mo).' };
  return { ok: true, ext };
}

// PDF (carrousel/document LinkedIn) : application/pdf, limite alignée sur
// LinkedIn documents = 100 Mo.
const MAX_PDF_BYTES = 100 * 1024 * 1024;

export function validatePdfFile(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  if (file.type !== 'application/pdf') {
    return { ok: false, message: 'Format non supporté (PDF uniquement).' };
  }
  if (file.size > MAX_PDF_BYTES) return { ok: false, message: 'PDF trop lourd (max 100 Mo).' };
  if (file.size < 1) return { ok: false, message: 'Fichier vide.' };
  return { ok: true };
}

// Vidéo : MP4 uniquement, limite alignée sur LinkedIn (feed) = 500 Mo.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export function validateVideoFile(file: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; message: string } {
  if (file.type !== 'video/mp4') return { ok: false, message: 'Format vidéo non supporté (mp4).' };
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, message: 'Vidéo trop lourde (max 500 Mo).' };
  if (file.size < 1) return { ok: false, message: 'Fichier vide.' };
  return { ok: true };
}
