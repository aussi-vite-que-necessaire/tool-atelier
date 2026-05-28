export type MediaKind = "image" | "video" | "pdf" | "render";

// Déduit le kind d'un média depuis l'extension de son URL (défaut image).
export function kindFromUrl(url: string): MediaKind {
  const clean = url.split("?")[0]!.toLowerCase();
  if (/\.(mp4|mov|webm)$/.test(clean)) return "video";
  if (/\.pdf$/.test(clean)) return "pdf";
  return "image";
}
