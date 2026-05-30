import { countMediaRecords, getMediaRecord, listMediaRecords } from './repository';
import type { MediaKind } from './types';

// Vue catalogue (sans champs internes r2_key/source/mime) consommée par le picker
// cast et les listings. Requête DB directe — pas de round-trip HTTP.
export type MediaItem = {
  id: string;
  url: string;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  prompt: string | null;
  tags: string[];
  created_at: number;
};

export type MediaListParams = {
  q?: string;
  kind?: MediaKind;
  tag?: string;
  orientation?: 'landscape' | 'portrait' | 'square';
  limit?: number;
  offset?: number;
};

// Liste paginée des médias d'un utilisateur (in-app). Isolation par userId garantie
// par le repository.
export async function listMedia(
  userId: string,
  params: MediaListParams,
): Promise<{ items: MediaItem[]; total: number; limit: number; offset: number }> {
  const repoParams = {
    query: params.q,
    kind: params.kind,
    tags: params.tag ? [params.tag] : undefined,
    orientation: params.orientation,
    limit: Math.min(Math.max(params.limit ?? 30, 1), 100),
    offset: Math.max(params.offset ?? 0, 0),
  };
  const [records, total] = await Promise.all([
    listMediaRecords(userId, repoParams),
    countMediaRecords(userId, repoParams),
  ]);
  const items: MediaItem[] = records.map((r) => ({
    id: r.id,
    url: r.url,
    kind: r.kind,
    width: r.width,
    height: r.height,
    prompt: r.prompt,
    tags: r.tags,
    created_at: r.created_at,
  }));
  return { items, total, limit: repoParams.limit, offset: repoParams.offset };
}

export async function getMedia(userId: string, id: string): Promise<MediaItem | null> {
  const r = await getMediaRecord(userId, id);
  if (!r) return null;
  return {
    id: r.id,
    url: r.url,
    kind: r.kind,
    width: r.width,
    height: r.height,
    prompt: r.prompt,
    tags: r.tags,
    created_at: r.created_at,
  };
}
