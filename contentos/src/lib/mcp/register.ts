import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { userIdFrom } from './auth';
import { errorResult, jsonResult } from './result';

// Résout le userId du token, exécute l'impl, et mappe vers le format MCP.
// Une erreur métier (entité introuvable, pré-condition) → résultat isError.
export async function handle(
  extra: { authInfo?: AuthInfo },
  fn: (userId: string) => Promise<unknown>,
) {
  try {
    return jsonResult(await fn(userIdFrom(extra)));
  } catch (e) {
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}
