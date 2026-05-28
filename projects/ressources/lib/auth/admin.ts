import { redirect } from "next/navigation"
import { adminUserIds } from "@/lib/env"
import { isPreview, PREVIEW_USER_ID } from "./preview"
import { getSession, signInUrl, type Session } from "./session"

// Un user.id (auth.contentos.ch) est admin s'il figure dans ADMIN_USER_IDS,
// ou si on est en preview (PREVIEW_USER_ID toujours admin).
export function userIsAdmin(userId: string | undefined | null): boolean {
  if (!userId) return false
  if (isPreview && userId === PREVIEW_USER_ID) return true
  return adminUserIds().has(userId)
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession()
  if (!s) redirect(signInUrl())
  if (!userIsAdmin(s.user.id)) redirect("/")
  return s
}
