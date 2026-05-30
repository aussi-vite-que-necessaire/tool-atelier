import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type PublicationFormat, publicationFormats } from '../schema';

export type CreatePublicationFormatInput = {
  name: string;
  platform: string;
  structure: string;
  visualIntent?: string | null;
  writingRules?: string | null;
};

export type UpdatePublicationFormatPatch = Partial<{
  name: string;
  platform: string;
  structure: string;
  visualIntent: string | null;
  writingRules: string | null;
}>;

export async function createPublicationFormat(
  userId: string,
  data: CreatePublicationFormatInput,
): Promise<PublicationFormat | undefined> {
  const [row] = await db
    .insert(publicationFormats)
    .values({
      id: createId(),
      userId,
      name: data.name,
      platform: data.platform,
      structure: data.structure,
      visualIntent: data.visualIntent ?? null,
      writingRules: data.writingRules ?? null,
    })
    .returning();
  return row;
}

export async function getPublicationFormat(
  userId: string,
  id: string,
): Promise<PublicationFormat | undefined> {
  const rows = await db
    .select()
    .from(publicationFormats)
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPublicationFormats(userId: string): Promise<PublicationFormat[]> {
  return db.select().from(publicationFormats).where(eq(publicationFormats.userId, userId));
}

export async function updatePublicationFormat(
  userId: string,
  id: string,
  patch: UpdatePublicationFormatPatch,
): Promise<PublicationFormat | undefined> {
  const rows = await db
    .update(publicationFormats)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePublicationFormat(userId: string, id: string): Promise<void> {
  await db
    .delete(publicationFormats)
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)));
}
