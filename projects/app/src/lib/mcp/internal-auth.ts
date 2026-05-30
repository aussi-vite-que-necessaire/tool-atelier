import { isPreview } from '@/lib/auth/preview';
import { bearerMatches } from './endpoint-auth';

// Garde de l'endpoint interne `/internal/tools` (contrat « passerelle » :
// userId transmis dans le corps). Preview : accès libre (fédération sans
// secret). Prod : exige `Authorization: Bearer <MCP_INTERNAL_KEY>` (clé partagée,
// scope global). L'endpoint MCP in-app de la suite est `/api/mcp` (session ou
// bearer) ; `/internal/tools` reste pour un appelant programmatique de confiance.
export function allowInternal(req: Request): boolean {
  if (isPreview) return true;
  return bearerMatches(req, process.env.MCP_INTERNAL_KEY ?? '');
}
