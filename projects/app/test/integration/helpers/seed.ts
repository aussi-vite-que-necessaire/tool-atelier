import { createId } from '@/lib/db/id';

// La table user vit côté auth.contentos.ch — pour les tests d'intégration,
// un simple id stable suffit (les colonnes user_id n'ont plus de FK locale).
export async function createTestUser(label: string): Promise<string> {
  return `${label}-${createId()}`;
}
