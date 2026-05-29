import { isPreview } from "@/lib/auth/preview";

// Comparaison à temps constant (résiste au timing).
function constantTimeEqual(a: string, b: string): boolean {
  if (b.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Garde des endpoints /internal (appelés par la passerelle MCP).
// En preview : accès libre (fédération sans secret, données preview isolées).
// En prod : exige `Authorization: Bearer <MCP_INTERNAL_KEY>` (clé partagée, scope global).
export function allowInternal(req: Request): boolean {
  if (isPreview) return true;
  const key = process.env.MCP_INTERNAL_KEY ?? "";
  if (!key) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return constantTimeEqual(header.slice("Bearer ".length), key);
}
