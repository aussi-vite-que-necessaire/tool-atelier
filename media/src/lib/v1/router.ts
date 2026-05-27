import { z } from "zod";
import { checkServiceKey } from "@/lib/service-auth";
import { generateImage, editImage } from "@/lib/gemini";
import { renderHtml } from "@/lib/render";
import { getImageBytes, deleteObject } from "@/lib/storage";
import { getImageRecord, deleteImageRow } from "@/lib/images/repository";
import { store } from "@/lib/store";

// Réponse JSON utilitaire.
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ── Schémas Zod ────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  prompt: z.string().min(1),
  // Pass-through : le ratio est validé par Gemini, pas figé ici (les appelants
  // de service, ex. ContentOS, ont leur propre palette : 1:1, 4:5, 16:9…).
  aspectRatio: z.string().min(1).default("1:1"),
  stylePrompt: z.string().optional(),
});

const EditSchema = z.object({
  sourceId: z.string().min(1),
  prompt: z.string().min(1),
});

const RenderHtmlSchema = z.object({
  html: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// ── Handlers ───────────────────────────────────────────────────────────────────

async function handleGenerate(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON invalide" }, 400);
  }
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, 400);
  }
  const { prompt, aspectRatio, stylePrompt } = parsed.data;
  const composed = stylePrompt ? `${prompt}\n\nStyle: ${stylePrompt}` : prompt;
  const { bytes, mimeType } = await generateImage(composed, aspectRatio);
  const rec = await store({
    bytes,
    mimeType,
    prompt: composed,
    parent_id: null,
    source: "gemini_generate",
    tags: [],
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handleEdit(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON invalide" }, 400);
  }
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, 400);
  }
  const { sourceId, prompt } = parsed.data;
  const source = await getImageRecord(sourceId);
  if (!source) return jsonResponse({ error: `Image introuvable: ${sourceId}` }, 404);
  const src = await getImageBytes(source.r2_key);
  if (!src) return jsonResponse({ error: `Fichier source absent du bucket: ${source.r2_key}` }, 404);
  const { bytes, mimeType } = await editImage(src.bytes, src.contentType, prompt);
  const rec = await store({
    bytes,
    mimeType,
    prompt,
    parent_id: source.id,
    source: "gemini_edit",
    tags: [],
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handleRenderHtml(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON invalide" }, 400);
  }
  const parsed = RenderHtmlSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, 400);
  }
  const { html, width, height } = parsed.data;
  const { bytes, mimeType } = await renderHtml({ html, width, height });
  const rec = await store({
    bytes,
    mimeType,
    prompt: null,
    parent_id: null,
    source: "html_render",
    tags: [],
    width,
    height,
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handleUpload(request: Request): Promise<Response> {
  const mimeType = request.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const rec = await store({
    bytes,
    mimeType,
    prompt: null,
    parent_id: null,
    source: "upload",
    tags: [],
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handleDelete(id: string): Promise<Response> {
  const rec = await getImageRecord(id);
  if (!rec) return jsonResponse({ deleted: false });
  const deleted = await deleteImageRow(id);
  if (deleted) {
    await deleteObject(rec.r2_key);
  }
  return jsonResponse({ deleted });
}

// ── Routeur principal ──────────────────────────────────────────────────────────

export async function handleV1(request: Request): Promise<Response> {
  if (!checkServiceKey(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === "POST" && pathname === "/v1/generate") {
    return handleGenerate(request);
  }
  if (method === "POST" && pathname === "/v1/edit") {
    return handleEdit(request);
  }
  if (method === "POST" && pathname === "/v1/render-html") {
    return handleRenderHtml(request);
  }
  if (method === "POST" && pathname === "/v1/upload") {
    return handleUpload(request);
  }

  // DELETE /v1/object/:id
  const deleteMatch = pathname.match(/^\/v1\/object\/([^/]+)$/);
  if (method === "DELETE" && deleteMatch) {
    return handleDelete(deleteMatch[1]);
  }

  return jsonResponse({ error: "Not found" }, 404);
}
