import { requireUserId } from '@/lib/auth/session';
import { ensureOperatorSettings, type OperatorSettings } from '@/lib/ressources/settings';

// Garde de la section admin ressources : session requise (requireUserId redirige
// sinon), puis garantit la ligne de réglages de l'opérateur (handle public). Tout
// opérateur connecté de la suite est opérateur ressources de plein droit.
export async function requireOperator(): Promise<OperatorSettings> {
  const userId = await requireUserId();
  return ensureOperatorSettings(userId);
}
