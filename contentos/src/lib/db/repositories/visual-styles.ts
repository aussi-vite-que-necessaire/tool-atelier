import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type VisualStyle, visualStyles } from '../schema';

export type CreateVisualStyleInput = {
  name: string;
  prompt: string;
};

export type UpdateVisualStylePatch = Partial<CreateVisualStyleInput>;

export async function createVisualStyle(
  userId: string,
  data: CreateVisualStyleInput,
): Promise<VisualStyle> {
  const id = createId();
  const [row] = await db
    .insert(visualStyles)
    .values({ id, userId, ...data })
    .returning();
  return row!;
}

export async function getVisualStyle(userId: string, id: string): Promise<VisualStyle | undefined> {
  const rows = await db
    .select()
    .from(visualStyles)
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listVisualStyles(userId: string): Promise<VisualStyle[]> {
  return db.select().from(visualStyles).where(eq(visualStyles.userId, userId));
}

export async function updateVisualStyle(
  userId: string,
  id: string,
  patch: UpdateVisualStylePatch,
): Promise<VisualStyle | undefined> {
  const rows = await db
    .update(visualStyles)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteVisualStyle(userId: string, id: string): Promise<void> {
  await db
    .delete(visualStyles)
    .where(and(eq(visualStyles.id, id), eq(visualStyles.userId, userId)));
}
