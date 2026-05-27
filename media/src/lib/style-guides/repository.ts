import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { styleGuides } from "@/db/schema";
import { newId } from "@/lib/ids";

type StyleGuide = typeof styleGuides.$inferSelect;

export async function createGuide(data: { name: string; content: string }): Promise<StyleGuide> {
  const [row] = await db
    .insert(styleGuides)
    .values({ id: newId(), ...data })
    .returning();
  return row!;
}

export async function getGuide(id: string): Promise<StyleGuide | undefined> {
  const rows = await db.select().from(styleGuides).where(eq(styleGuides.id, id)).limit(1);
  return rows[0];
}

export async function listGuides(): Promise<StyleGuide[]> {
  return db.select().from(styleGuides).orderBy(desc(styleGuides.createdAt));
}

export async function updateGuide(
  id: string,
  patch: Partial<{ name: string; content: string }>,
): Promise<StyleGuide | undefined> {
  const rows = await db
    .update(styleGuides)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(styleGuides.id, id))
    .returning();
  return rows[0];
}

export async function deleteGuide(id: string): Promise<void> {
  await db.delete(styleGuides).where(eq(styleGuides.id, id));
}
