import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type WritingTemplate, writingTemplates } from '../schema';

export type CreateWritingTemplateInput = {
  name: string;
  platform: string;
  structure: string;
  writingRules?: string | null;
};

export type UpdateWritingTemplatePatch = Partial<{
  name: string;
  platform: string;
  structure: string;
  writingRules: string | null;
}>;

export async function createWritingTemplate(
  userId: string,
  data: CreateWritingTemplateInput,
): Promise<WritingTemplate | undefined> {
  const id = createId();
  const [row] = await db
    .insert(writingTemplates)
    .values({
      id,
      userId,
      name: data.name,
      platform: data.platform,
      structure: data.structure,
      writingRules: data.writingRules ?? null,
    })
    .returning();
  return row;
}

export async function getWritingTemplate(
  userId: string,
  id: string,
): Promise<WritingTemplate | undefined> {
  const rows = await db
    .select()
    .from(writingTemplates)
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listWritingTemplates(userId: string): Promise<WritingTemplate[]> {
  return db.select().from(writingTemplates).where(eq(writingTemplates.userId, userId));
}

export async function updateWritingTemplate(
  userId: string,
  id: string,
  patch: UpdateWritingTemplatePatch,
): Promise<WritingTemplate | undefined> {
  const rows = await db
    .update(writingTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteWritingTemplate(userId: string, id: string): Promise<void> {
  await db
    .delete(writingTemplates)
    .where(and(eq(writingTemplates.id, id), eq(writingTemplates.userId, userId)));
}
