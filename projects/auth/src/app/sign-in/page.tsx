"use client";

import { useState } from "react";
import { authClient, signIn } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const input =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-700";
  const btn =
    "w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <h1 className="text-center text-2xl font-bold tracking-tight">Se connecter</h1>

      <input
        className={input}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <section className="space-y-3">
        {!otpSent ? (
          <button
            className={btn}
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
              className={input + " text-center font-mono tracking-[0.4em]"}
              inputMode="numeric"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <button
              className={btn}
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
      </section>

      {msg && <p className="text-center text-sm text-zinc-500">{msg}</p>}
    </main>
  );
}
