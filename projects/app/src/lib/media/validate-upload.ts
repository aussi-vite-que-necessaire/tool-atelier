import { kindForMime, type MediaKind } from './types';

const LIMITS: Record<string, number> = {
  'image/png': 10_000_000,
  'image/jpeg': 10_000_000,
  'image/webp': 10_000_000,
  'application/pdf': 100_000_000,
  'video/mp4': 500_000_000,
};

export type ValidateResult = { ok: true; kind: MediaKind } | { ok: false; error: string };

// Valide type MIME + taille d'un upload. Limites : image 10 Mo, pdf 100 Mo, mp4 500 Mo.
export function validateUpload(mime: string, sizeBytes: number): ValidateResult {
  const limit = LIMITS[mime];
  if (!limit) return { ok: false, error: `Type non supporté: ${mime}` };
  if (sizeBytes > limit) return { ok: false, error: `Fichier trop volumineux pour ${mime}` };
  return { ok: true, kind: kindForMime(mime) };
}
