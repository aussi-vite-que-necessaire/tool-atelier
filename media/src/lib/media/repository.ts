import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { clampLimit } from "@/lib/tags";
import type { MediaKind, MediaRecord, MediaSource } from "./types";

type Row = typeof media.$inferSelect;

function toRecord(r: Row): MediaRecord {
  return {
    id: r.id,
    r2_key: r.r2Key,
    url: r.url,
    kind: r.kind as MediaKind,
    mime: r.mime,
    prompt: r.prompt,
    parent_id: r.parentId,
    source: r.source as MediaSource,
    template_id: r.templateId,
    vars: r.vars ?? null,
    style_id: r.styleId,
    tags: r.tags ?? [],
    width: r.width,
    height: r.height,
    size_bytes: r.sizeBytes,
    created_at: r.createdAt.getTime(),
  };
}

// jsonb @> : toutes les tags requises présentes (intersection, en SQL).
function sqlHasAllTags(tags: string[]) {
  return sql`${media.tags} @> ${JSON.stringify(tags)}::jsonb`;
}

export async function insertMedia(rec: MediaRecord): Promise<void> {
  await db.insert(media).values({
    id: rec.id,
    r2Key: rec.r2_key,
    url: rec.url,
    kind: rec.kind,
    mime: rec.mime,
    prompt: rec.prompt,
    parentId: rec.parent_id,
    source: rec.source,
    templateId: rec.template_id,
    vars: rec.vars ?? undefined,
    styleId: rec.style_id,
    tags: rec.tags,
    width: rec.width,
    height: rec.height,
    sizeBytes: rec.size_bytes,
    createdAt: new Date(rec.created_at),
  });
}

export async function getMediaRecord(id: string): Promise<MediaRecord | null> {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function deleteMediaRow(id: string): Promise<boolean> {
  const deleted = await db.delete(media).where(eq(media.id, id)).returning({ id: media.id });
  return deleted.length > 0;
}

export type Orientation = "landscape" | "portrait" | "square";

// Classe une orientation à partir des dimensions (tolérance ±5% pour le carré).
export function orientationRatio(width: number, height: number): Orientation {
  if (!width || !height) return "square";
  const r = width / height;
  if (r > 1.05) return "landscape";
  if (r < 0.95) return "portrait";
  return "square";
}

export interface ListParams {
  query?: string;
  tags?: string[];
  source?: MediaSource;
  kind?: MediaKind;
  limit?: number;
  offset?: number;
  orientation?: Orientation;
}

// Construit les conditions WHERE partagées par list et count.
function buildConds(params: ListParams) {
  const conds = [];
  if (params.query) {
    conds.push(
      or(
        ilike(media.prompt, `%${params.query}%`),
        sql`${media.tags}::text ilike ${"%" + params.query + "%"}`,
      ),
    );
  }
  if (params.source) conds.push(eq(media.source, params.source));
  if (params.kind) conds.push(eq(media.kind, params.kind));
  if (params.tags?.length) conds.push(sqlHasAllTags(params.tags));
  if (params.orientation === "landscape") {
    conds.push(sql`${media.height} > 0 AND ${media.width}::float / ${media.height} > 1.05`);
  } else if (params.orientation === "portrait") {
    conds.push(sql`${media.height} > 0 AND ${media.width}::float / ${media.height} < 0.95`);
  } else if (params.orientation === "square") {
    conds.push(sql`${media.height} > 0 AND ${media.width}::float / ${media.height} BETWEEN 0.95 AND 1.05`);
  }
  return conds;
}

export async function listMediaRecords(params: ListParams): Promise<MediaRecord[]> {
  const conds = buildConds(params);
  const rows = await db
    .select()
    .from(media)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(media.createdAt))
    .limit(clampLimit(params.limit))
    .offset(params.offset ?? 0);
  return rows.map(toRecord);
}

export async function countMediaRecords(params: ListParams): Promise<number> {
  const conds = buildConds(params);
  const [row] = await db
    .select({ c: count() })
    .from(media)
    .where(conds.length ? and(...conds) : undefined);
  return row?.c ?? 0;
}
