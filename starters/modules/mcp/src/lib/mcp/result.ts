// Helper de résultat MCP : enveloppe une valeur en content block texte (JSON).
export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}
