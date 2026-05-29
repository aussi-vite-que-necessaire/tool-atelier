import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// ressources est l'outil d'administration. La racine renvoie au tableau de bord.
// L'espace public de lecture (landing, espaces /o/<handle>, reader, bibliothèque)
// vit sur le projet `docs` (docs.contentos.ch).
export default function HomePage() {
  redirect("/admin")
}
