import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(session.user as { isAdmin?: boolean }).isAdmin) {
    redirect("/connexion")
  }
  return session
}
