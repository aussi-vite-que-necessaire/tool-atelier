import { env } from "@/lib/env";
import type { MediaKind } from "./kind";

export type MediaItem = { id: string; url: string; kind: MediaKind; width: number | null; height: number | null; prompt: string | null; tags: string[]; created_at: number };
export type MediaListParams = { q?: string; kind?: MediaKind; tag?: string; orientation?: "landscape" | "portrait" | "square"; limit?: number; offset?: number };

function base(): string {
  if (!env.MEDIA_ENGINE_URL || !env.MEDIA_ENGINE_SERVICE_KEY) throw new Error("MEDIA_ENGINE_URL/KEY manquants");
  return env.MEDIA_ENGINE_URL.replace(/\/$/, "");
}
function authHeaders() { return { Authorization: `Bearer ${env.MEDIA_ENGINE_SERVICE_KEY}` }; }

// Toutes les fonctions du catalogue média prennent un userId — le service media
// isole les données par utilisateur (cf. /v1 router côté media). Pas de fallback :
// l'absence d'userId est un bug d'appelant, pas un cas à gérer silencieusement.
export async function listMedia(userId: string, params: MediaListParams): Promise<{ items: MediaItem[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  qs.set("userId", userId);
  if (params.q) qs.set("q", params.q);
  if (params.kind) qs.set("kind", params.kind);
  if (params.tag) qs.set("tag", params.tag);
  if (params.orientation) qs.set("orientation", params.orientation);
  qs.set("limit", String(params.limit ?? 30));
  qs.set("offset", String(params.offset ?? 0));
  const res = await fetch(`${base()}/v1/media?${qs}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`media list ${res.status}`);
  return res.json();
}

export async function getMedia(userId: string, id: string): Promise<MediaItem | null> {
  const qs = new URLSearchParams({ userId });
  const res = await fetch(`${base()}/v1/media/${encodeURIComponent(id)}?${qs}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`media get ${res.status}`);
  return res.json();
}
