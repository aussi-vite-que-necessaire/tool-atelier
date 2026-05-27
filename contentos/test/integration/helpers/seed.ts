import { db } from '@/lib/db/client';
import { createId } from '@/lib/db/id';
import { user } from '@/lib/db/schema';

export async function createTestUser(label: string): Promise<string> {
  const id = createId();
  const email = `${label}-${id}@test.local`;
  await db.insert(user).values({ id, email });
  return id;
}
