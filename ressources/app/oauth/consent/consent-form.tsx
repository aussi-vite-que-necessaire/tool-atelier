"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export function ConsentForm() {
  const params = useSearchParams()
  const router = useRouter()
  const consentCode = params.get("consent_code")
  const clientId = params.get("client_id")
  const scope = params.get("scope")
  const [loading, setLoading] = useState<"accept" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(accept: boolean) {
    setLoading(accept ? "accept" : "deny")
    setError(null)
    const { data, error } = await authClient.oauth2.consent({
      accept,
      consent_code: consentCode ?? undefined,
    })
    if (error) {
      setError("Échec. Réessaie.")
      setLoading(null)
      return
    }
    // better-auth renvoie l'URL de reprise du flux OAuth (retour vers le client).
    const d = data as { redirectURI?: string; redirect_uri?: string; url?: string } | null
    const next = d?.redirectURI ?? d?.redirect_uri ?? d?.url
    if (next) {
      window.location.href = next
      return
    }
    // Pas d'URL : on retombe sur un refresh (le flux a peut-être déjà posé un cookie).
    router.refresh()
  }

  const btn = "px-4 py-2 font-bold disabled:opacity-50"

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-20">
      <h1 className="text-3xl font-black tracking-tight">Autoriser l&apos;accès</h1>
      <p className="mt-3 text-muted-foreground">
        Une application{clientId ? ` (${clientId})` : ""} demande l&apos;accès à tes ressources
        {scope ? ` — ${scope}` : ""}.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => decide(true)}
          disabled={loading !== null}
          className={`border-4 border-foreground bg-foreground text-background ${btn}`}
        >
          {loading === "accept" ? "…" : "Autoriser"}
        </button>
        <button
          onClick={() => decide(false)}
          disabled={loading !== null}
          className={`border-2 border-foreground ${btn}`}
        >
          Refuser
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-muted-foreground">{error}</p>}
    </main>
  )
}
