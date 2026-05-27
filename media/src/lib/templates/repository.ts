import { desc, eq } from "drizzle-orm";
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

export async function createTemplate(data: CreateTemplateInput): Promise<VisualTemplate> {
  // Valide le schéma de variables avant insertion (throw si mal formé / nom dupliqué).
  parseVariablesSchema(data.variablesSchema ?? []);
  const [row] = await db
    .insert(visualTemplates)
    .values({
      id: newId(),
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

export async function getTemplate(id: string): Promise<VisualTemplate | undefined> {
  const rows = await db.select().from(visualTemplates).where(eq(visualTemplates.id, id)).limit(1);
  return rows[0];
}

export async function getTemplateBySlug(slug: string): Promise<VisualTemplate | undefined> {
  const rows = await db
    .select()
    .from(visualTemplates)
    .where(eq(visualTemplates.slug, slug))
    .limit(1);
  return rows[0];
}

export async function listTemplates(opts: { styleGuideId?: string } = {}): Promise<VisualTemplate[]> {
  const base = db.select().from(visualTemplates);
  const rows = opts.styleGuideId
    ? await base.where(eq(visualTemplates.styleGuideId, opts.styleGuideId)).orderBy(desc(visualTemplates.createdAt))
    : await base.orderBy(desc(visualTemplates.createdAt));
  return rows;
}

export async function updateTemplate(
  id: string,
  patch: UpdateTemplatePatch,
): Promise<VisualTemplate | undefined> {
  if (patch.variablesSchema !== undefined) {
    parseVariablesSchema(patch.variablesSchema);
  }
  const rows = await db
    .update(visualTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(visualTemplates.id, id))
    .returning();
  return rows[0];
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.delete(visualTemplates).where(eq(visualTemplates.id, id));
}
