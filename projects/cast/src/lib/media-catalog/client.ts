import { env } from "@/lib/env";
import type { MediaKind } from "./kind";

export type MediaItem = { id: string; url: string; kind: MediaKind; width: number | null; height: number | null; prompt: string | null; tags: string[]; created_at: number };
export type MediaListParams = { q?: string; kind?: MediaKind; tag?: string; orientation?: "landscape" | "portrait" | "square"; limit?: number; offset?: number };

function base(): string {
  if (!env.MEDIA_ENGINE_URL || !env.MEDIA_ENGINE_SERVICE_KEY) throw new Error("MEDIA_ENGINE_URL/KEY manquants");
  return env.MEDIA_ENGINE_URL.replace(/\/$/, "");
}
function authHeaders() { return { Authorization: `Bearer ${env.MEDIA_ENGINE_SERVICE_KEY}` }; }

export async function listMedia(params: MediaListParams): Promise<{ items: MediaItem[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
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

export async function getMedia(id: string): Promise<MediaItem | null> {
  const res = await fetch(`${base()}/v1/media/${encodeURIComponent(id)}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`media get ${res.status}`);
  return res.json();
}
