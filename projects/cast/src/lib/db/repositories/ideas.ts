import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Idea, ideas } from '../schema';

export type CreateIdeaInput = { idea: string; brief?: string };
export type UpdateIdeaPatch = Partial<{ idea: string; brief: string | null }>;

export async function createIdea(userId: string, data: CreateIdeaInput): Promise<Idea> {
  const id = createId();
  const [row] = await db
    .insert(ideas)
    .values({ id, userId, idea: data.idea, brief: data.brief ?? null })
    .returning();
  return row!;
}

export async function getIdea(userId: string, id: string): Promise<Idea | undefined> {
  const rows = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listIdeas(userId: string): Promise<Idea[]> {
  return db.select().from(ideas).where(eq(ideas.userId, userId)).orderBy(desc(ideas.updatedAt));
}

export async function updateIdea(
  userId: string,
  id: string,
  patch: UpdateIdeaPatch,
): Promise<Idea | undefined> {
  const rows = await db
    .update(ideas)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteIdea(userId: string, id: string): Promise<void> {
  await db.delete(ideas).where(and(eq(ideas.id, id), eq(ideas.userId, userId)));
}
