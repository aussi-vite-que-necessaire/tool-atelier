import { z } from "zod";
import { checkServiceKey } from "@/lib/service-auth";
import { generateImage, editImage } from "@/lib/gemini";
import { renderHtml } from "@/lib/render";
import { getImageBytes, deleteObject } from "@/lib/storage";
import { getMediaRecord, deleteMediaRow, listMediaRecords, countMediaRecords } from "@/lib/media/repository";
import type { Orientation } from "@/lib/media/repository";
import type { MediaKind } from "@/lib/media/types";
import { store } from "@/lib/store";
import { getStyle } from "@/lib/styles/repository";
import { composePrompt } from "@/lib/styles/compose";
import { renderTemplate } from "@/lib/templates/render";
import { aggregatePdf } from "@/lib/pdf/aggregate";
import { validateUpload } from "@/lib/media/validate-upload";

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
  styleId: z.string().optional(),
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

const RenderTemplateSchema = z.object({
  templateId: z.string().min(1),
  vars: z.record(z.string(), z.unknown()).default({}),
});

const PdfSchema = z.object({
  imageIds: z.array(z.string()).min(1),
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
  const { prompt, aspectRatio, stylePrompt, styleId } = parsed.data;
  // Résolution du style : stylePrompt explicite prioritaire, sinon résolution depuis l'id.
  let stylePromptResolved: string | undefined = stylePrompt;
  if (!stylePromptResolved && styleId) {
    const st = await getStyle(styleId);
    stylePromptResolved = st?.prompt;
  }
  const composed = composePrompt(prompt, stylePromptResolved);
  const { bytes, mimeType } = await generateImage(composed, aspectRatio);
  const rec = await store({
    bytes,
    mimeType,
    kind: "image",
    prompt: composed,
    parent_id: null,
    source: "gemini_generate",
    tags: [],
    style_id: styleId ?? null,
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
  const source = await getMediaRecord(sourceId);
  if (!source) return jsonResponse({ error: `Image introuvable: ${sourceId}` }, 404);
  const src = await getImageBytes(source.r2_key);
  if (!src) return jsonResponse({ error: `Fichier source absent du bucket: ${source.r2_key}` }, 404);
  const { bytes, mimeType } = await editImage(src.bytes, src.contentType, prompt);
  const rec = await store({
    bytes,
    mimeType,
    kind: "image",
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
    kind: "render",
    prompt: null,
    parent_id: null,
    source: "html_render",
    tags: [],
    width,
    height,
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handleRenderTemplate(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON invalide" }, 400);
  }
  const parsed = RenderTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, 400);
  }
  const { templateId, vars } = parsed.data;
  try {
    const rec = await renderTemplate(templateId, vars);
    return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec du rendu du template";
    // Template inexistant → 404 ; validation des variables ou autre → 400.
    const status = message.includes("introuvable") ? 404 : 400;
    return jsonResponse({ error: message }, status);
  }
}

async function handleUpload(request: Request): Promise<Response> {
  // Normalise le MIME : retire les paramètres éventuels (ex. "; charset=binary").
  const rawContentType = request.headers.get("content-type") ?? "application/octet-stream";
  const mime = rawContentType.split(";")[0].trim();
  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const result = validateUpload(mime, bytes.byteLength);
  if (!result.ok) return jsonResponse({ error: result.error }, 400);
  const rec = await store({
    bytes,
    mimeType: mime,
    kind: result.kind,
    prompt: null,
    parent_id: null,
    source: "upload",
    tags: [],
  });
  return jsonResponse({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
}

async function handlePdf(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Corps JSON invalide" }, 400);
  }
  const parsed = PdfSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.issues[0]?.message ?? "Paramètres invalides" }, 400);
  }
  const { imageIds } = parsed.data;
  try {
    const rec = await aggregatePdf(imageIds);
    return jsonResponse({ id: rec.id, url: rec.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de la construction du PDF";
    const status = message.includes("introuvable") ? 404 : 400;
    return jsonResponse({ error: message }, status);
  }
}

async function handleListMedia(url: URL): Promise<Response> {
  const p = url.searchParams;
  const kindParam = p.get("kind");
  const kind = (kindParam === "image" || kindParam === "video" || kindParam === "pdf" || kindParam === "render") ? (kindParam as MediaKind) : undefined;
  const oParam = p.get("orientation");
  const orientation = (oParam === "landscape" || oParam === "portrait" || oParam === "square") ? (oParam as Orientation) : undefined;
  const limit = Math.min(Math.max(Number(p.get("limit") ?? 30) || 30, 1), 100);
  const offset = Math.max(Number(p.get("offset") ?? 0) || 0, 0);
  const params = { query: p.get("q") || undefined, tags: p.get("tag") ? [p.get("tag")!] : undefined, kind, orientation, limit, offset };
  const [items, total] = await Promise.all([listMediaRecords(params), countMediaRecords(params)]);
  const view = items.map((r) => ({ id: r.id, url: r.url, kind: r.kind, width: r.width, height: r.height, prompt: r.prompt, tags: r.tags, created_at: r.created_at }));
  return jsonResponse({ items: view, total, limit, offset });
}

async function handleGetMedia(id: string): Promise<Response> {
  const rec = await getMediaRecord(id);
  if (!rec) return jsonResponse({ error: "Média introuvable" }, 404);
  return jsonResponse({ id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height, prompt: rec.prompt, tags: rec.tags, created_at: rec.created_at });
}

async function handleDelete(id: string): Promise<Response> {
  const rec = await getMediaRecord(id);
  if (!rec) return jsonResponse({ deleted: false });
  const deleted = await deleteMediaRow(id);
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
  if (method === "POST" && pathname === "/v1/render-template") {
    return handleRenderTemplate(request);
  }
  if (method === "POST" && pathname === "/v1/upload") {
    return handleUpload(request);
  }
  if (method === "POST" && pathname === "/v1/pdf") {
    return handlePdf(request);
  }

  // DELETE /v1/object/:id
  const deleteMatch = pathname.match(/^\/v1\/object\/([^/]+)$/);
  if (method === "DELETE" && deleteMatch) {
    return handleDelete(deleteMatch[1]);
  }

  if (method === "GET" && pathname === "/v1/media") return handleListMedia(url);
  const getMatch = pathname.match(/^\/v1\/media\/([^/]+)$/);
  if (method === "GET" && getMatch) return handleGetMedia(getMatch[1]);

  return jsonResponse({ error: "Not found" }, 404);
}
