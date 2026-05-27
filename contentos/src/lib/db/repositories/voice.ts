import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Voice, voice } from '../schema';

export type CreateVoiceInput = { name: string; content: string };
export type UpdateVoicePatch = Partial<{ name: string; content: string }>;

export async function listVoices(userId: string): Promise<Voice[]> {
  return db.select().from(voice).where(eq(voice.userId, userId));
}

export async function getVoice(userId: string, id: string): Promise<Voice | undefined> {
  const rows = await db
    .select()
    .from(voice)
    .where(and(eq(voice.id, id), eq(voice.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function createVoice(userId: string, data: CreateVoiceInput): Promise<Voice> {
  const [row] = await db
    .insert(voice)
    .values({ id: createId(), userId, name: data.name, content: data.content })
    .returning();
  return row!;
}

export async function updateVoice(
  userId: string,
  id: string,
  patch: UpdateVoicePatch,
): Promise<Voice | undefined> {
  const rows = await db
    .update(voice)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(voice.id, id), eq(voice.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteVoice(userId: string, id: string): Promise<void> {
  await db.delete(voice).where(and(eq(voice.id, id), eq(voice.userId, userId)));
}
