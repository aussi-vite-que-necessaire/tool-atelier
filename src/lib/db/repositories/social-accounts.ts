import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type SocialAccount, socialAccounts } from '../schema';

export type UpsertSocialAccountInput = {
  platform: string;
  externalId: string;
  displayName: string;
  accessToken: string;
  expiresAt: Date;
  scopes: string;
};

export async function getSocialAccount(
  userId: string,
  platform: string,
): Promise<SocialAccount | undefined> {
  const rows = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform)))
    .limit(1);
  return rows[0];
}

export async function upsertSocialAccount(
  userId: string,
  data: UpsertSocialAccountInput,
): Promise<SocialAccount> {
  const [row] = await db
    .insert(socialAccounts)
    .values({ id: createId(), userId, ...data })
    .onConflictDoUpdate({
      target: [socialAccounts.userId, socialAccounts.platform],
      set: {
        externalId: data.externalId,
        displayName: data.displayName,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function deleteSocialAccount(userId: string, platform: string): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform)));
}
