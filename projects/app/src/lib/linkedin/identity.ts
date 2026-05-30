import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { type LinkedInAuthor, resolveAuthor } from './author';

export type { LinkedInAuthor } from './author';

// Charge l'identité réelle de l'utilisateur depuis le compte LinkedIn connecté.
// Le nom user vit dans auth.contentos.ch ; ici on se contente de displayName
// (LinkedIn) — le repli 'Vous' couvre le reste.
export async function getAuthorIdentity(userId: string): Promise<LinkedInAuthor> {
  const account = await getSocialAccount(userId, 'linkedin');
  return resolveAuthor({ displayName: account?.displayName });
}
