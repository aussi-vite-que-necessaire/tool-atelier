import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getSettings } from '@/lib/db/repositories/settings';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { user } from '@/lib/db/schema';
import { type LinkedInAuthor, resolveAuthor } from './author';

export type { LinkedInAuthor } from './author';

// Charge l'identité réelle de l'utilisateur (compte LinkedIn + marque + nom).
export async function getAuthorIdentity(userId: string): Promise<LinkedInAuthor> {
  const [account, settings, rows] = await Promise.all([
    getSocialAccount(userId, 'linkedin'),
    getSettings(userId),
    db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1),
  ]);
  return resolveAuthor({
    displayName: account?.displayName,
    brandName: settings?.brandName,
    brandSignature: settings?.brandSignature,
    brandLogoUrl: settings?.brandLogoUrl,
    userName: rows[0]?.name,
  });
}
