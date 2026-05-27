import type { MediaKind } from "./types";

// Déduit le type de média à partir du MIME (uploads). Inconnu → image (cas le plus courant).
export function kindForMime(mime: string): MediaKind {
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "image";
}
