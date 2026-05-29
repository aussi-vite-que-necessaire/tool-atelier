import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { resSettings, user } from '@/lib/db/schema';
import { normalizeHandle } from './settings-validate';
import type { ThemeConfig } from './theme';

export type OperatorSettings = {
  userId: string;
  handle: string;
  name: string;
  brandName: string | null;
  theme: ThemeConfig | null;
};

// Référence opérateur minimale pour le data-layer : id (scoping) + handle (URLs).
export type OpRef = { id: string; handle: string };

function toSettings(row: typeof resSettings.$inferSelect, name: string): OperatorSettings {
  return {
    userId: row.userId,
    handle: row.handle,
    name,
    brandName: row.brandName ?? null,
    theme: row.theme ?? null,
  };
}

async function userNameAndEmail(userId: string): Promise<{ name: string; email: string }> {
  const [u] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return { name: u?.name ?? 'Opérateur', email: u?.email ?? '' };
}

async function handleTaken(handle: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: resSettings.userId })
    .from(resSettings)
    .where(eq(resSettings.handle, handle))
    .limit(1);
  return !!row;
}

// Garantit une ligne de réglages pour l'utilisateur (idempotent). Le handle est
// dérivé du nom/email puis dé-dupliqué globalement. C'est la porte d'entrée de
// la section admin : tout opérateur connecté en obtient une.
export async function ensureOperatorSettings(userId: string): Promise<OperatorSettings> {
  const [existing] = await db
    .select()
    .from(resSettings)
    .where(eq(resSettings.userId, userId))
    .limit(1);
  const { name, email } = await userNameAndEmail(userId);
  if (existing) return toSettings(existing, name);

  const base = normalizeHandle(name || email.split('@')[0] || 'espace');
  let handle = base;
  let i = 2;
  while (await handleTaken(handle)) {
    handle = `${base}-${i}`;
    i++;
  }
  const [row] = await db
    .insert(resSettings)
    .values({ userId, handle, brandName: null, theme: null })
    .onConflictDoNothing()
    .returning();
  if (row) return toSettings(row, name);
  // Course concurrente : une autre requête a inséré entre-temps.
  const [again] = await db
    .select()
    .from(resSettings)
    .where(eq(resSettings.userId, userId))
    .limit(1);
  return toSettings(again!, name);
}

export async function getOperatorByHandle(handle: string): Promise<OperatorSettings | null> {
  const [row] = await db.select().from(resSettings).where(eq(resSettings.handle, handle)).limit(1);
  if (!row) return null;
  const { name } = await userNameAndEmail(row.userId);
  return toSettings(row, name);
}

export async function saveOperatorSettings(
  userId: string,
  patch: { brandName: string | null; theme: ThemeConfig },
): Promise<void> {
  await db
    .update(resSettings)
    .set({ brandName: patch.brandName, theme: patch.theme, updatedAt: new Date() })
    .where(eq(resSettings.userId, userId));
}
