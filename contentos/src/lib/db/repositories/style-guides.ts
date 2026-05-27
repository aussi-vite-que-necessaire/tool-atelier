import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type StyleGuide, styleGuides } from '../schema';

export type CreateStyleGuideInput = {
  name: string;
  content: string;
};

export type UpdateStyleGuidePatch = Partial<CreateStyleGuideInput>;

export async function createStyleGuide(
  userId: string,
  data: CreateStyleGuideInput,
): Promise<StyleGuide> {
  const id = createId();
  const [row] = await db
    .insert(styleGuides)
    .values({ id, userId, ...data })
    .returning();
  return row!;
}

export async function getStyleGuide(userId: string, id: string): Promise<StyleGuide | undefined> {
  const rows = await db
    .select()
    .from(styleGuides)
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listStyleGuides(userId: string): Promise<StyleGuide[]> {
  return db.select().from(styleGuides).where(eq(styleGuides.userId, userId));
}

export async function updateStyleGuide(
  userId: string,
  id: string,
  patch: UpdateStyleGuidePatch,
): Promise<StyleGuide | undefined> {
  const rows = await db
    .update(styleGuides)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteStyleGuide(userId: string, id: string): Promise<void> {
  await db.delete(styleGuides).where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)));
}
