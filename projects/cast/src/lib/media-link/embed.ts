import type { MediaKind } from "@/lib/media-catalog/kind";
import type { MediaRef } from "./resolve";

// Contrat postMessage entre la page /embed de media (iframe) et cast (parent).
// Dupliqué à l'identique côté media (src/lib/embed/contract.ts) — 15 lignes stables,
// pas de package partagé ; un test de chaque côté verrouille la forme.
export const MEDIA_CREATED = "contentos:media-created" as const;

export type CreatedMedia = {
  id: string;
  url: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
};

const KINDS = new Set<MediaKind>(["image", "video", "pdf", "render"]);

// Vrai si le message reçu par postMessage est bien un « média créé ». Ne valide
// pas le contenu de `media` (c'est le rôle de mediaRefFromCreatedMedia, côté serveur).
export function isMediaCreatedMessage(data: unknown): data is { type: typeof MEDIA_CREATED; media: unknown } {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { type?: unknown }).type === MEDIA_CREATED &&
    "media" in (data as object)
  );
}

// Valide un descripteur de média créé et le convertit en MediaRef attachable.
// Retourne null si invalide (url non absolue http(s), kind inconnu). Source de
// confiance équivalente au flux d'attache par URL existant (MCP), donc on valide
// la forme mais on fait confiance à l'URL R2 publique fournie par l'iframe validée.
export function mediaRefFromCreatedMedia(media: unknown): MediaRef | null {
  if (!media || typeof media !== "object") return null;
  const m = media as Record<string, unknown>;
  const { id, url, kind, width, height } = m;

  if (typeof url !== "string" || !/^https?:\/\/.+/i.test(url)) return null;
  if (typeof kind !== "string" || !KINDS.has(kind as MediaKind)) return null;

  return {
    media_id: typeof id === "string" && id.length > 0 ? id : null,
    media_url: url,
    media_kind: kind as MediaKind,
    media_width: typeof width === "number" ? width : null,
    media_height: typeof height === "number" ? height : null,
  };
}
