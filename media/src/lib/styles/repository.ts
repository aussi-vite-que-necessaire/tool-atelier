import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { visualStyles } from "@/db/schema";
import { newId } from "@/lib/ids";

type VisualStyle = typeof visualStyles.$inferSelect;

export async function createStyle(data: { name: string; prompt: string }): Promise<VisualStyle> {
  const [row] = await db
    .insert(visualStyles)
    .values({ id: newId(), ...data })
    .returning();
  return row!;
}

export async function getStyle(id: string): Promise<VisualStyle | undefined> {
  const rows = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).limit(1);
  return rows[0];
}

export async function listStyles(): Promise<VisualStyle[]> {
  return db.select().from(visualStyles).orderBy(desc(visualStyles.createdAt));
}

export async function updateStyle(
  id: string,
  patch: Partial<{ name: string; prompt: string }>,
): Promise<VisualStyle | undefined> {
  const rows = await db
    .update(visualStyles)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(visualStyles.id, id))
    .returning();
  return rows[0];
}

export async function deleteStyle(id: string): Promise<void> {
  await db.delete(visualStyles).where(eq(visualStyles.id, id));
}
