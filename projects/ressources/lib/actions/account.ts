"use server"

import { redirect } from "next/navigation"
import { env } from "@/lib/env"

// Sign-out de l'opérateur, déléguée à auth.contentos.ch : redirige vers la page de
// sign-in du provider (qui propose la déconnexion + retour ici via le cookie
// cross-domain). Les actions d'abonnement lecteur (unsubscribe…) vivent désormais
// dans le projet `docs`.
export async function signOutAction() {
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`)
}
