import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type VisualTemplate, visualTemplates } from '../schema';

export type CreateVisualTemplateInput = {
  slug: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: unknown;
  styleGuideId?: string | null;
};

export type UpdateVisualTemplatePatch = Partial<{
  slug: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: unknown;
  styleGuideId: string | null;
}>;

export async function createVisualTemplate(
  userId: string,
  data: CreateVisualTemplateInput,
): Promise<VisualTemplate | undefined> {
  const id = createId();
  const [row] = await db
    .insert(visualTemplates)
    .values({ id, userId, ...data })
    .onConflictDoNothing({ target: [visualTemplates.userId, visualTemplates.slug] })
    .returning();
  return row;
}

export async function getVisualTemplate(
  userId: string,
  id: string,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .select()
    .from(visualTemplates)
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function getVisualTemplateBySlug(
  userId: string,
  slug: string,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .select()
    .from(visualTemplates)
    .where(and(eq(visualTemplates.slug, slug), eq(visualTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listVisualTemplates(userId: string): Promise<VisualTemplate[]> {
  return db.select().from(visualTemplates).where(eq(visualTemplates.userId, userId));
}

export async function listVisualTemplatesByStyleGuide(
  userId: string,
  styleGuideId: string,
): Promise<VisualTemplate[]> {
  return db
    .select()
    .from(visualTemplates)
    .where(and(eq(visualTemplates.userId, userId), eq(visualTemplates.styleGuideId, styleGuideId)));
}

export async function updateVisualTemplate(
  userId: string,
  id: string,
  patch: UpdateVisualTemplatePatch,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .update(visualTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteVisualTemplate(userId: string, id: string): Promise<void> {
  await db
    .delete(visualTemplates)
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)));
}
