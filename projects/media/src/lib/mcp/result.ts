import { bytesToBase64 } from "@/lib/base64";

type Block = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

// Résultat avec l'image embarquée (content block image MCP) + métadonnées texte.
// L'image s'affiche inline dans le client sans dépendre de l'URL/CORS ; l'URL
// reste dans le texte pour réutilisation (docs, posts).
export function imageResult(bytes: Uint8Array, mimeType: string, meta: unknown) {
  return {
    content: [
      { type: "image" as const, data: bytesToBase64(bytes), mimeType },
      { type: "text" as const, text: JSON.stringify(meta) },
    ] satisfies Block[],
  };
}
