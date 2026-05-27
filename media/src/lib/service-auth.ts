// Vérification de la clé de service pour l'API /v1.
// Comparaison à temps constant pour résister aux attaques par timing.

function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (b.length === 0) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Retourne true si la requête porte un header Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY> valide.
export function checkServiceKey(request: Request): boolean {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  return constantTimeEqual(provided, process.env.MEDIA_ENGINE_SERVICE_KEY ?? "");
}
