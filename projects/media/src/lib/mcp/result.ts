import type { ToolResult } from "./types";

// Enveloppe une valeur en content block texte (JSON). URL-only : les tools
// image renvoient { id, url, ... }, jamais les octets.
export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

// Erreur métier (entité introuvable, pré-condition) → résultat MCP isError.
export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
