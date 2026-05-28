"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
} from "@/lib/templates/repository";
import { renderTemplate } from "@/lib/templates/render";
import { requireUserId } from "@/lib/session";

export async function createTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const slug = (formData.get("slug") as string | null)?.trim() ?? "";
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const width = parseInt((formData.get("width") as string | null) ?? "1200", 10);
  const height = parseInt((formData.get("height") as string | null) ?? "630", 10);
  const bodyHtml = (formData.get("body_html") as string | null) ?? "";

  if (!slug || !label) return;

  const created = await createTemplate(userId, {
    slug,
    label,
    width,
    height,
    bodyHtml,
    css: "",
    variablesSchema: [],
    sampleVars: {},
    platform: "linkedin",
  });

  redirect("/templates/" + created.id);
}

export async function saveTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) return;

  const variablesSchemaRaw = (formData.get("variables_schema") as string | null) ?? "[]";
  const sampleVarsRaw = (formData.get("sample_vars") as string | null) ?? "{}";

  let variablesSchema: unknown[];
  let sampleVars: Record<string, unknown>;

  try {
    variablesSchema = JSON.parse(variablesSchemaRaw) as unknown[];
  } catch {
    throw new Error("variables_schema : JSON invalide");
  }

  try {
    sampleVars = JSON.parse(sampleVarsRaw) as Record<string, unknown>;
  } catch {
    throw new Error("sample_vars : JSON invalide");
  }

  const styleGuideIdRaw = (formData.get("style_guide_id") as string | null) ?? "";

  await updateTemplate(userId, id, {
    slug: (formData.get("slug") as string | null)?.trim() ?? "",
    label: (formData.get("label") as string | null)?.trim() ?? "",
    platform: (formData.get("platform") as string | null)?.trim() ?? "linkedin",
    width: parseInt((formData.get("width") as string | null) ?? "1200", 10),
    height: parseInt((formData.get("height") as string | null) ?? "630", 10),
    bodyHtml: (formData.get("body_html") as string | null) ?? "",
    css: (formData.get("css") as string | null) ?? "",
    variablesSchema,
    sampleVars,
    styleGuideId: styleGuideIdRaw || null,
  });

  revalidatePath("/templates/" + id);
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get("id") as string | null) ?? "";
  if (id) {
    await deleteTemplate(userId, id);
  }
  revalidatePath("/templates");
}

export async function previewTemplateAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const userId = await requireUserId();
  const id = String(formData.get("id"));
  try {
    const t = await getTemplate(userId, id);
    if (!t) return { error: "Template introuvable" };
    const rec = await renderTemplate(userId, id, (t.sampleVars ?? {}) as Record<string, unknown>, {
      imagesOptional: true,
    });
    return { url: rec.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec du rendu" };
  }
}
