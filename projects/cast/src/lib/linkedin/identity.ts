import { getSettings } from '@/lib/db/repositories/settings';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { type LinkedInAuthor, resolveAuthor } from './author';

export type { LinkedInAuthor } from './author';

// Charge l'identité réelle de l'utilisateur (compte LinkedIn + marque).
// Le nom user vit dans auth.contentos.ch ; ici on se contente de displayName
// (LinkedIn) et brandName (settings) — fallback 'Vous' couvre le reste.
export async function getAuthorIdentity(userId: string): Promise<LinkedInAuthor> {
  const [account, settings] = await Promise.all([
    getSocialAccount(userId, 'linkedin'),
    getSettings(userId),
  ]);
  return resolveAuthor({
    displayName: account?.displayName,
    brandName: settings?.brandName,
    brandSignature: settings?.brandSignature,
    brandLogoUrl: settings?.brandLogoUrl,
  });
}
