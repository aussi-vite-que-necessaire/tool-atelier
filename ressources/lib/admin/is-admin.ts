import { eq } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema"

export async function userIsAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const [u] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, userId)).limit(1)
  return !!u?.isAdmin
}
