"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { env } from "@/lib/env"
import { getSession } from "@/lib/auth/session"
import { removeSubscription } from "@/lib/content/queries"

export async function unsubscribeAction(formData: FormData) {
  const resourceId = String(formData.get("resourceId"))
  const session = await getSession()
  if (!session) return
  await removeSubscription(session.user.id, resourceId)
  revalidatePath("/compte")
  revalidatePath("/bibliotheque")
}

// Sign-out déléguée à auth.contentos.ch : redirige vers la page de sign-in du
// provider (laquelle propose la déconnexion + retour ici via le cookie cross-domain).
export async function signOutAction() {
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`)
}
