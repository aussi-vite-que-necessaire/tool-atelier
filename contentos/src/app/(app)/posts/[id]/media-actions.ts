'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { createCarouselCore } from '@/lib/carousel/carousel-core';
import { uploadCarouselPdfCore } from '@/lib/carousel/upload-pdf-core';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { uploadVideoCore } from '@/lib/media/upload-video-core';
import { enqueueRenderVisual } from '@/lib/queue/enqueue';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { compileTemplate } from '@/lib/visual-templates/compile';
import {
  fillVarDefaults,
  parseVariablesSchema,
  variablesSchemaToZod,
} from '@/lib/visual-templates/dsl';
import { attachExistingMediaCore } from './media-actions-core';

// Placeholder gris pour les variables image non encore choisies (live preview).
const IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e5e5"/></svg>',
)}`;

// Compile le HTML du template avec les vars courantes (images résolues en URL
// signée) sans passer par Puppeteer : sert à l'aperçu live pendant l'édition.
export async function renderTemplatePreviewHtmlAction(input: {
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<{ status: 'success'; html: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const template = await getVisualTemplate(userId, input.templateId);
  if (!template) return { status: 'error', message: 'Template introuvable' };

  const brand = await buildBrandContext(userId);

  const schema = parseVariablesSchema(template.variablesSchema);
  const context = fillVarDefaults(schema, input.vars);
  for (const spec of schema) {
    if (spec.type !== 'image') continue;
    const mediaId =
      typeof input.vars[spec.name] === 'string' ? (input.vars[spec.name] as string) : '';
    let url = IMAGE_PLACEHOLDER;
    if (mediaId) {
      const m = await getMedia(userId, mediaId);
      if (m) url = m.assetKey; // assetKey = URL publique engine
    }
    context[spec.name] = url;
  }

  return { status: 'success', html: compileTemplate({ template, vars: context, brand }) };
}

type EnqueueResult = { status: 'success'; jobKey: string } | { status: 'error'; message: string };

export async function enqueuePostFinalAction(input: {
  postId: string;
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<EnqueueResult> {
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, input.templateId);
  if (!t) return { status: 'error', message: 'Template introuvable' };
  const post = await getPost(userId, input.postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  try {
    variablesSchemaToZod(parseVariablesSchema(t.variablesSchema)).parse(input.vars);
  } catch (e) {
    return { status: 'error', message: `Vars invalides : ${(e as Error).message}` };
  }
  const jobKey = randomUUID();
  await enqueueRenderVisual({
    userId,
    templateId: t.id,
    vars: input.vars,
    mode: 'final',
    postId: post.id,
    jobKey,
  });
  return { status: 'success', jobKey };
}

export async function detachMediaAction(
  postId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  await updatePost(userId, postId, { mediaId: null });
  revalidatePath(`/posts/${postId}`);
  return { status: 'success' };
}

export async function attachExistingMediaAction(input: {
  postId: string;
  mediaId: string;
}): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const r = await attachExistingMediaCore(userId, input.postId, input.mediaId);
  if (r.status === 'success') revalidatePath(`/posts/${input.postId}`);
  return r;
}

export async function createCarouselAction(input: {
  postId: string;
  slideKeys: string[];
}): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const r = await createCarouselCore(userId, input);
  if (r.status === 'success') revalidatePath(`/posts/${input.postId}`);
  return r.status === 'success' ? { status: 'success' } : r;
}

export async function uploadVideoAction(
  formData: FormData,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const postId = formData.get('postId');
  const file = formData.get('file');
  if (typeof postId !== 'string' || !(file instanceof File)) {
    return { status: 'error', message: 'Requête invalide' };
  }
  const r = await uploadVideoCore(userId, file, { postId });
  if (r.status === 'success') revalidatePath(`/posts/${postId}`);
  return r.status === 'success' ? { status: 'success' } : r;
}

export async function uploadCarouselPdfAction(
  formData: FormData,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const postId = formData.get('postId');
  const file = formData.get('file');
  if (typeof postId !== 'string' || !(file instanceof File)) {
    return { status: 'error', message: 'Requête invalide' };
  }
  const r = await uploadCarouselPdfCore(userId, file, { postId });
  if (r.status === 'success') revalidatePath(`/posts/${postId}`);
  return r.status === 'success' ? { status: 'success' } : r;
}
