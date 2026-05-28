"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { authClient } from "@/lib/auth-client"

export function OtpForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })
    setLoading(false)
    if (error) setError("Envoi impossible. Réessaie.")
    else setStep("code")
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await authClient.signIn.emailOtp({ email, otp: code })
    setLoading(false)
    if (error) {
      setError("Code invalide ou expiré.")
      return
    }
    router.refresh()
    if (redirectTo) router.push(redirectTo)
  }

  const button =
    "press w-full border-2 border-ink bg-accent px-3 py-3 font-bold uppercase tracking-wide text-accent-ink shadow-brutal"

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <label className="label" htmlFor="otp-email">
            Adresse email
          </label>
          <input
            id="otp-email"
            type="email"
            required
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <button type="submit" disabled={loading} className={button}>
          {loading ? "Envoi…" : "Recevoir mon code"}
        </button>
        {error && <p className="border-2 border-ink bg-c-warn px-3 py-2 text-sm font-bold">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-ink-soft">
        Code envoyé à <span className="font-bold text-ink">{email}</span>.
      </p>
      <div>
        <label className="label" htmlFor="otp-code">
          Code à 6 chiffres
        </label>
        <input
          id="otp-code"
          inputMode="numeric"
          required
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field text-center font-mono text-2xl font-bold tracking-[0.5em]"
        />
      </div>
      <button type="submit" disabled={loading} className={button}>
        {loading ? "Vérification…" : "Accéder"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email")
          setError(null)
        }}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.5} /> Changer d&apos;email
      </button>
      {error && <p className="border-2 border-ink bg-c-warn px-3 py-2 text-sm font-bold">{error}</p>}
    </form>
  )
}
