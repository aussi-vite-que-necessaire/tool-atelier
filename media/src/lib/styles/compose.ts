// Compose le prompt de génération avec le suffixe de style (même format que le /v1 existant).
export function composePrompt(prompt: string, stylePrompt: string | null | undefined): string {
  const s = (stylePrompt ?? "").trim();
  return s ? `${prompt}\n\nStyle: ${s}` : prompt;
}
