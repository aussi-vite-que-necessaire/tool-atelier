import { eq } from 'drizzle-orm';
import { db } from '../client';
import { type Settings, settings } from '../schema';

export async function getSettings(userId: string): Promise<Settings | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertSettings(userId: string): Promise<Settings> {
  await db.insert(settings).values({ userId }).onConflictDoNothing();
  return (await getSettings(userId))!;
}

type SettingsPatch = Partial<Pick<Settings, 'brandName' | 'brandSignature' | 'brandLogoUrl'>>;

export async function updateSettings(
  userId: string,
  patch: SettingsPatch,
): Promise<Settings | undefined> {
  await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.userId, userId));
  return getSettings(userId);
}
