"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function OtpForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setLoading(false);
    if (error) setError("Envoi impossible. Réessaie.");
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    setLoading(false);
    if (error) {
      setError("Code invalide ou expiré.");
      return;
    }
    router.refresh();
    router.push(redirectTo);
  }

  const button = "rounded bg-black px-3 py-2 text-white disabled:opacity-50";

  if (step === "email") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="toi@exemple.com"
          disabled={loading}
          className="rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading || !email} className={button}>
          {loading ? "Envoi…" : "Recevoir mon code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Code envoyé à <span className="font-medium text-gray-900">{email}</span> (valable 10 min).
      </p>
      <input
        inputMode="numeric"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="000000"
        disabled={loading}
        className="rounded border px-3 py-2 text-center font-mono text-2xl tracking-[0.5em]"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading || code.length < 6} className={button}>
        {loading ? "Vérification…" : "Se connecter"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("email");
          setError(null);
        }}
        className="text-xs text-gray-500 underline"
      >
        Changer d&apos;email
      </button>
    </form>
  );
}
