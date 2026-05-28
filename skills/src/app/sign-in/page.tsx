"use client";

import { useState } from "react";
import { authClient, signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Connexion</h1>
      <p className="text-sm text-gray-600">Reçois un code par email pour te connecter.</p>

      <input
        className="rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {!otpSent ? (
        <button
          className="rounded border border-gray-900 bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!email}
          onClick={async () => {
            await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
            setOtpSent(true);
            setMsg("Code envoyé (000000 en preview).");
          }}
        >
          Recevoir un code
        </button>
      ) : (
        <>
          <input
            className="rounded border border-gray-300 px-3 py-2 text-center font-mono text-sm tracking-[0.4em] outline-none focus:border-gray-500"
            inputMode="numeric"
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button
            className="rounded border border-gray-900 bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={otp.length < 6}
            onClick={async () => {
              const r = await signIn.emailOtp({ email, otp });
              setMsg(r.error ? "Code invalide." : "Connecté.");
              if (!r.error) location.href = "/";
            }}
          >
            Valider le code
          </button>
        </>
      )}

      {msg && <p className="text-xs text-gray-500">{msg}</p>}
    </main>
  );
}
