import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { visualTemplates } from "@/db/schema";
import { newId } from "@/lib/ids";
import { parseVariablesSchema } from "./dsl";

type VisualTemplate = typeof visualTemplates.$inferSelect;

export interface CreateTemplateInput {
  slug: string;
  label: string;
  platform?: string;
  width: number;
  height: number;
  bodyHtml: string;
  css?: string;
  variablesSchema?: unknown[];
  sampleVars?: Record<string, unknown>;
  styleGuideId?: string | null;
}

export type UpdateTemplatePatch = Partial<CreateTemplateInput>;

export async function createTemplate(
  userId: string,
  data: CreateTemplateInput,
): Promise<VisualTemplate> {
  // Valide le schéma de variables avant insertion (throw si mal formé / nom dupliqué).
  parseVariablesSchema(data.variablesSchema ?? []);
  const [row] = await db
    .insert(visualTemplates)
    .values({
      id: newId(),
      userId,
      slug: data.slug,
      label: data.label,
      platform: data.platform ?? "linkedin",
      width: data.width,
      height: data.height,
      bodyHtml: data.bodyHtml,
      css: data.css ?? "",
      variablesSchema: data.variablesSchema ?? [],
      sampleVars: data.sampleVars ?? {},
      styleGuideId: data.styleGuideId ?? null,
    })
    .returning();
  return row!;
}

export async function getTemplate(
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

export async function getTemplateBySlug(
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

export async function listTemplates(
  userId: string,
  opts: { styleGuideId?: string } = {},
): Promise<VisualTemplate[]> {
  const conds = [eq(visualTemplates.userId, userId)];
  if (opts.styleGuideId) conds.push(eq(visualTemplates.styleGuideId, opts.styleGuideId));
  return db
    .select()
    .from(visualTemplates)
    .where(and(...conds))
    .orderBy(desc(visualTemplates.createdAt));
}

export async function updateTemplate(
  userId: string,
  id: string,
  patch: UpdateTemplatePatch,
): Promise<VisualTemplate | undefined> {
  if (patch.variablesSchema !== undefined) {
    parseVariablesSchema(patch.variablesSchema);
  }
  const rows = await db
    .update(visualTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteTemplate(userId: string, id: string): Promise<void> {
  await db
    .delete(visualTemplates)
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)));
}
