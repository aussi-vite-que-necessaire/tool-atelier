import type { MediaKind } from "@/lib/media/types";

// Contrat postMessage entre la page /embed de media (iframe) et son parent (cast).
// Dupliqué à l'identique côté cast (15 lignes stables, pas de package partagé) ;
// un test de chaque côté verrouille la forme.
export const MEDIA_CREATED = "contentos:media-created" as const;

export type CreatedMedia = {
  id: string; // id du média dans media (référence)
  url: string; // URL publique R2 (absolue http(s))
  kind: MediaKind;
  width: number | null;
  height: number | null;
};

export type MediaCreatedMessage = {
  type: typeof MEDIA_CREATED;
  media: CreatedMedia;
};

// Réduit un enregistrement média (ou tout objet portant ces champs) au descripteur
// transmis au parent. Tolère les dims absentes (→ null).
export function toCreatedMedia(rec: {
  id: string;
  url: string;
  kind: MediaKind;
  width?: number | null;
  height?: number | null;
}): CreatedMedia {
  return {
    id: rec.id,
    url: rec.url,
    kind: rec.kind,
    width: rec.width ?? null,
    height: rec.height ?? null,
  };
}
