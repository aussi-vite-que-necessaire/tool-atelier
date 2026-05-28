"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { removeSubscription } from "@/lib/content/queries"
import { normalizeName } from "@/lib/account"

export async function unsubscribeAction(formData: FormData) {
  const resourceId = String(formData.get("resourceId"))
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return
  await removeSubscription(session.user.id, resourceId)
  revalidatePath("/compte")
  revalidatePath("/bibliotheque")
}

export async function updateNameAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return
  const name = normalizeName(String(formData.get("name") ?? ""))
  await auth.api.updateUser({ body: { name }, headers: await headers() })
  revalidatePath("/compte")
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() })
  redirect("/connexion")
}
