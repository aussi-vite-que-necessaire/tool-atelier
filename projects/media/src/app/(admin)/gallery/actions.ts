"use server";

import { revalidatePath } from "next/cache";
import { getMediaRecord, deleteMediaRow } from "@/lib/media/repository";
import { deleteObject, getImageBytes } from "@/lib/storage";
import { store } from "@/lib/store";
import { validateUpload } from "@/lib/media/validate-upload";
import { generateImage, editImage } from "@/lib/gemini";
import { getStyle } from "@/lib/styles/repository";
import { composePrompt } from "@/lib/styles/compose";
import { requireUserId } from "@/lib/session";

// État renvoyé par les actions IA, consommé par useActionState côté client.
interface AiResult {
  id?: string;
  url?: string;
  error?: string;
}

export async function uploadAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validateUpload(file.type, bytes.byteLength);
  if (!result.ok) throw new Error(result.error);

  await store({
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
    return { id: rec.id, url: rec.url };
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
    return { id: rec.id, url: rec.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Échec de l'édition." };
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
