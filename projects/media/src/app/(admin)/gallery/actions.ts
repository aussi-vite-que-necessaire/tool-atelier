"use server";

import { revalidatePath } from "next/cache";
import { getMediaRecord, deleteMediaRow } from "@/lib/media/repository";
import type { MediaKind } from "@/lib/media/types";
import { deleteObject, getImageBytes } from "@/lib/storage";
import { store } from "@/lib/store";
import { validateUpload } from "@/lib/media/validate-upload";
import { generateImage, editImage } from "@/lib/gemini";
import { getStyle } from "@/lib/styles/repository";
import { composePrompt } from "@/lib/styles/compose";
import { requireUserId } from "@/lib/session";
import { getTemplate } from "@/lib/templates/repository";
import { compileTemplate } from "@/lib/templates/compile";
import { fillVarDefaults, parseVariablesSchema } from "@/lib/templates/dsl";
import { getBrandContext } from "@/lib/brand/repository";
import { renderTemplate } from "@/lib/templates/render";

// État renvoyé par les actions IA, consommé par useActionState côté client.
// Les champs kind/width/height alimentent le descripteur transmis au parent en
// mode embarqué (cf. src/lib/embed/contract.ts) ; ignorés par l'admin.
interface AiResult {
  id?: string;
  url?: string;
  kind?: MediaKind;
  width?: number | null;
  height?: number | null;
  error?: string;
}

// Résultat de l'upload, consommé par useActionState (UploadForm). Renvoie le
// descripteur du média créé pour permettre l'attache en mode embarqué.
export interface UploadResult {
  id?: string;
  url?: string;
  kind?: MediaKind;
  width?: number | null;
  height?: number | null;
  error?: string;
}

export async function uploadAction(
  _prev: UploadResult,
  formData: FormData,
): Promise<UploadResult> {
  const userId = await requireUserId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validateUpload(file.type, bytes.byteLength);
  if (!result.ok) return { error: result.error };

  try {
    const rec = await store({
      userId,
      bytes,
      mimeType: file.type,
      kind: result.kind,
      prompt: null,
      parent_id: null,
      source: "upload",
      tags: [],
    });
    revalidatePath("/gallery");
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'upload." };
  }
}

export async function generateAction(
  _prev: AiResult,
  formData: FormData,
): Promise<AiResult> {
  const userId = await requireUserId();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) return { error: "Le prompt est requis." };
  const aspectRatio = String(formData.get("aspectRatio") ?? "1:1") || "1:1";
  const styleId = (String(formData.get("styleId") ?? "")).trim() || undefined;

  try {
    let stylePrompt: string | undefined;
    if (styleId) {
      const st = await getStyle(userId, styleId);
      stylePrompt = st?.prompt;
    }
    const composed = composePrompt(prompt, stylePrompt);
    const { bytes, mimeType } = await generateImage(composed, aspectRatio);
    const rec = await store({
      userId,
      bytes,
      mimeType,
      kind: "image",
      prompt: composed,
      parent_id: null,
      source: "gemini_generate",
      tags: [],
      style_id: styleId ?? null,
    });
    revalidatePath("/gallery");
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de la génération." };
  }
}

export async function editAction(
  _prev: AiResult,
  formData: FormData,
): Promise<AiResult> {
  const userId = await requireUserId();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!sourceId) return { error: "Image source manquante." };
  if (!prompt) return { error: "Le prompt est requis." };

  try {
    const source = await getMediaRecord(userId, sourceId);
    if (!source) return { error: `Image introuvable : ${sourceId}` };
    const src = await getImageBytes(source.r2_key);
    if (!src) return { error: "Fichier source absent du bucket." };
    const { bytes, mimeType } = await editImage(src.bytes, src.contentType, prompt);
    const rec = await store({
      userId,
      bytes,
      mimeType,
      kind: "image",
      prompt,
      parent_id: source.id,
      source: "gemini_edit",
      tags: [],
    });
    revalidatePath("/gallery");
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'édition." };
  }
}

// Aperçu HTML d'un template : compile le Handlebars (variables + marque) et
// renvoie le HTML, SANS passer par Chromium ni stocker quoi que ce soit. Sert
// l'aperçu live de l'onglet « Template » de la modal. Tolérant : remplit les
// variables manquantes par leurs valeurs par défaut (formulaire en cours
// d'édition), ne valide pas strictement.
export async function previewTemplateHtmlAction(
  templateId: string,
  vars: Record<string, unknown>,
): Promise<{ html?: string; error?: string }> {
  const userId = await requireUserId();
  try {
    const template = await getTemplate(userId, templateId);
    if (!template) return { error: "Template introuvable" };
    const schema = parseVariablesSchema(template.variablesSchema);
    const filled = fillVarDefaults(schema, vars);
    const brand = await getBrandContext(userId);
    return { html: compileTemplate({ template, vars: filled, brand }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'aperçu." };
  }
}

// Rendu final d'un template en image (Chromium) puis stockage en galerie. Les
// variables image restent optionnelles pour ne pas bloquer un rendu partiel.
export async function renderTemplateFromTemplateAction(
  templateId: string,
  vars: Record<string, unknown>,
): Promise<
  | { ok: true; id: string; url: string; kind: MediaKind; width: number | null; height: number | null }
  | { ok: false; error: string }
> {
  const userId = await requireUserId();
  try {
    const rec = await renderTemplate(userId, templateId, vars, {
      imagesOptional: true,
    });
    revalidatePath("/gallery");
    return { ok: true, id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec du rendu." };
  }
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) return;

  const rec = await getMediaRecord(userId, id);
  if (rec) {
    await deleteMediaRow(userId, id);
    await deleteObject(rec.r2_key);
  }

  revalidatePath("/gallery");
}
