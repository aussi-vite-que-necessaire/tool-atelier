import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";
import { clampLimit } from "@/lib/tags";
import type { ImageRecord, ImageSource } from "./types";

type Row = typeof images.$inferSelect;

function toRecord(r: Row): ImageRecord {
  return {
    id: r.id,
    r2_key: r.r2Key,
    url: r.url,
    prompt: r.prompt,
    parent_id: r.parentId,
    source: r.source as ImageSource,
    tags: r.tags ?? [],
    width: r.width,
    height: r.height,
    created_at: r.createdAt.getTime(),
  };
}

// jsonb @> : toutes les tags requises présentes (intersection, en SQL).
function sqlHasAllTags(tags: string[]) {
  return sql`${images.tags} @> ${JSON.stringify(tags)}::jsonb`;
}

export async function insertImage(rec: ImageRecord): Promise<void> {
  await db.insert(images).values({
    id: rec.id,
    r2Key: rec.r2_key,
    url: rec.url,
    prompt: rec.prompt,
    parentId: rec.parent_id,
    source: rec.source,
    tags: rec.tags,
    width: rec.width,
    height: rec.height,
    createdAt: new Date(rec.created_at),
  });
}

export async function getImageRecord(id: string): Promise<ImageRecord | null> {
  const [row] = await db.select().from(images).where(eq(images.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function deleteImageRow(id: string): Promise<boolean> {
  const deleted = await db.delete(images).where(eq(images.id, id)).returning({ id: images.id });
  return deleted.length > 0;
}

export interface ListParams {
  query?: string;
  tags?: string[];
  source?: ImageSource;
  limit?: number;
}

export async function listImageRecords(params: ListParams): Promise<ImageRecord[]> {
  const conds = [];
  if (params.query) conds.push(ilike(images.prompt, `%${params.query}%`));
  if (params.source) conds.push(eq(images.source, params.source));
  if (params.tags?.length) conds.push(sqlHasAllTags(params.tags));

  const rows = await db
    .select()
    .from(images)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(images.createdAt))
    .limit(clampLimit(params.limit));
  return rows.map(toRecord);
}
