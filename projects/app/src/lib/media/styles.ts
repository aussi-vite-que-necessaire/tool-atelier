import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { visualStyles } from '@/lib/db/schema';
import { newId } from './ids';

type VisualStyle = typeof visualStyles.$inferSelect;

// Compose le prompt de génération avec le suffixe de style.
export function composePrompt(prompt: string, stylePrompt: string | null | undefined): string {
  const s = (stylePrompt ?? '').trim();
  return s ? `${prompt}\n\nStyle: ${s}` : prompt;
}

export async function createStyle(
  userId: string,
  data: { name: string; prompt: string },
): Promise<VisualStyle> {
  const [row] = await db
    .insert(visualStyles)
    .values({ id: newId(), userId, ...data })
    .returning();
  return row!;
}

export async function getStyle(userId: string, id: string): Promise<VisualStyle | undefined> {
  const rows = await db
    .select()
    .from(visualStyles)
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listStyles(userId: string): Promise<VisualStyle[]> {
  return db
    .select()
    .from(visualStyles)
    .where(eq(visualStyles.userId, userId))
    .orderBy(desc(visualStyles.createdAt));
}

export async function updateStyle(
  userId: string,
  id: string,
  patch: Partial<{ name: string; prompt: string }>,
): Promise<VisualStyle | undefined> {
  const rows = await db
    .update(visualStyles)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteStyle(userId: string, id: string): Promise<void> {
  await db.delete(visualStyles).where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)));
}
