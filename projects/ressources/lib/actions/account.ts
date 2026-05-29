"use server"

import { redirect } from "next/navigation"
import { signOutUrl } from "@/lib/auth/session"

// Sign-out de l'opérateur, déléguée à auth.contentos.ch. En preview, passe par
// preview-logout (efface la session + pose le marqueur → chooser). Les actions
// d'abonnement lecteur (unsubscribe…) vivent désormais dans le projet `docs`.
export async function signOutAction() {
  redirect(signOutUrl())
}
