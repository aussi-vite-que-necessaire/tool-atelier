import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { styleGuides } from "@/db/schema";
import { newId } from "@/lib/ids";

type StyleGuide = typeof styleGuides.$inferSelect;

export async function createGuide(
  userId: string,
  data: { name: string; content: string },
): Promise<StyleGuide> {
  const [row] = await db
    .insert(styleGuides)
    .values({ id: newId(), userId, ...data })
    .returning();
  return row!;
}

export async function getGuide(userId: string, id: string): Promise<StyleGuide | undefined> {
  const rows = await db
    .select()
    .from(styleGuides)
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listGuides(userId: string): Promise<StyleGuide[]> {
  return db
    .select()
    .from(styleGuides)
    .where(eq(styleGuides.userId, userId))
    .orderBy(desc(styleGuides.createdAt));
}

export async function updateGuide(
  userId: string,
  id: string,
  patch: Partial<{ name: string; content: string }>,
): Promise<StyleGuide | undefined> {
  const rows = await db
    .update(styleGuides)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteGuide(userId: string, id: string): Promise<void> {
  await db
    .delete(styleGuides)
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)));
}
