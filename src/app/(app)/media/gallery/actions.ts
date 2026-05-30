'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { getBrandContext } from '@/lib/media/brand';
import { editImage, generateImage } from '@/lib/media/gemini';
import { aggregatePdf } from '@/lib/media/pdf';
import { deleteMediaRow, getMediaRecord } from '@/lib/media/repository';
import { deleteObject, getImageBytes } from '@/lib/media/storage';
import { store } from '@/lib/media/store';
import { composePrompt, getStyle } from '@/lib/media/styles';
import { compileTemplate } from '@/lib/media/templates/compile';
import { fillVarDefaults, parseVariablesSchema } from '@/lib/media/templates/dsl';
import { renderTemplate } from '@/lib/media/templates/render';
import { getTemplate } from '@/lib/media/templates/repository';
import type { MediaKind } from '@/lib/media/types';
import { validateUpload } from '@/lib/media/validate-upload';

// Descripteur du média produit, consommé par useActionState côté client.
interface AiResult {
  id?: string;
  url?: string;
  kind?: MediaKind;
  width?: number | null;
  height?: number | null;
  error?: string;
}

export type UploadResult = AiResult;

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function uploadAction(_prev: UploadResult, formData: FormData): Promise<UploadResult> {
  const userId = await requireUserId();
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { error: 'Aucun fichier.' };

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
      source: 'upload',
      tags: [],
    });
    revalidatePath('/media/gallery');
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: message(e, "Échec de l'upload.") };
  }
}

export async function generateAction(_prev: AiResult, formData: FormData): Promise<AiResult> {
  const userId = await requireUserId();
  const prompt = String(formData.get('prompt') ?? '').trim();
  if (!prompt) return { error: 'Le prompt est requis.' };
  const aspectRatio = String(formData.get('aspectRatio') ?? '1:1') || '1:1';
  const styleId = String(formData.get('styleId') ?? '').trim() || undefined;

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
      kind: 'image',
      prompt: composed,
      parent_id: null,
      source: 'gemini_generate',
      tags: [],
      style_id: styleId ?? null,
    });
    revalidatePath('/media/gallery');
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: message(e, 'Échec de la génération.') };
  }
}

export async function editAction(_prev: AiResult, formData: FormData): Promise<AiResult> {
  const userId = await requireUserId();
  const sourceId = String(formData.get('sourceId') ?? '').trim();
  const prompt = String(formData.get('prompt') ?? '').trim();
  if (!sourceId) return { error: 'Image source manquante.' };
  if (!prompt) return { error: 'Le prompt est requis.' };

  try {
    const source = await getMediaRecord(userId, sourceId);
    if (!source) return { error: `Image introuvable : ${sourceId}` };
    const src = await getImageBytes(source.r2_key);
    if (!src) return { error: 'Fichier source absent du bucket.' };
    const { bytes, mimeType } = await editImage(src.bytes, src.contentType, prompt);
    const rec = await store({
      userId,
      bytes,
      mimeType,
      kind: 'image',
      prompt,
      parent_id: source.id,
      source: 'gemini_edit',
      tags: [],
    });
    revalidatePath('/media/gallery');
    return { id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height };
  } catch (e) {
    return { error: message(e, "Échec de l'édition.") };
  }
}

// Aperçu HTML d'un template : compile le Handlebars (variables + marque) sans
// passer par Chromium ni stocker. Tolérant : remplit les variables manquantes.
export async function previewTemplateHtmlAction(
  templateId: string,
  vars: Record<string, unknown>,
): Promise<{ html?: string; error?: string }> {
  const userId = await requireUserId();
  try {
    const template = await getTemplate(userId, templateId);
    if (!template) return { error: 'Template introuvable' };
    const schema = parseVariablesSchema(template.variablesSchema);
    const filled = fillVarDefaults(schema, vars);
    const brand = await getBrandContext(userId);
    return { html: compileTemplate({ template, vars: filled, brand }) };
  } catch (e) {
    return { error: message(e, "Échec de l'aperçu.") };
  }
}

// Rendu final d'un template en image (Chromium) puis stockage en galerie.
export async function renderTemplateAction(
  templateId: string,
  vars: Record<string, unknown>,
): Promise<
  | {
      ok: true;
      id: string;
      url: string;
      kind: MediaKind;
      width: number | null;
      height: number | null;
    }
  | { ok: false; error: string }
> {
  const userId = await requireUserId();
  try {
    const rec = await renderTemplate(userId, templateId, vars, { imagesOptional: true });
    revalidatePath('/media/gallery');
    return {
      ok: true,
      id: rec.id,
      url: rec.url,
      kind: rec.kind,
      width: rec.width,
      height: rec.height,
    };
  } catch (e) {
    return { ok: false, error: message(e, 'Échec du rendu.') };
  }
}

// Agrège des images (par id, dans l'ordre) en un PDF stocké en galerie.
export async function aggregatePdfAction(
  imageIds: string[],
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    const rec = await aggregatePdf(userId, imageIds);
    revalidatePath('/media/gallery');
    return { ok: true, id: rec.id, url: rec.url };
  } catch (e) {
    return { ok: false, error: message(e, 'Échec de la construction du PDF.') };
  }
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get('id') as string | null) ?? '';
  if (!id) return;

  const rec = await getMediaRecord(userId, id);
  if (rec) {
    await deleteMediaRow(userId, id);
    await deleteObject(rec.r2_key).catch(() => {});
  }
  revalidatePath('/media/gallery');
}
