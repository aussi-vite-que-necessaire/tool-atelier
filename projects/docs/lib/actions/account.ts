"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getSession, signOutUrl } from "@/lib/auth/session"
import { removeSubscription } from "@/lib/content/queries"

export async function unsubscribeAction(formData: FormData) {
  const resourceId = String(formData.get("resourceId"))
  const session = await getSession()
  if (!session) return
  await removeSubscription(session.user.id, resourceId)
  revalidatePath("/compte")
  revalidatePath("/bibliotheque")
}

// Sign-out déléguée à auth.contentos.ch. En preview, passe par preview-logout
// (efface la session + pose le marqueur → chooser).
export async function signOutAction() {
  redirect(signOutUrl())
}
