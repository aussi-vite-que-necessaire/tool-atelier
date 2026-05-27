"use client";

import { useState } from "react";
import { AUTH_METHODS } from "@/lib/auth-methods";
import { authClient, signIn, signUp } from "@/lib/auth-client";

// Page de connexion adaptative : affiche une section par méthode active
// (générée dans AUTH_METHODS par le compositeur selon les choix du wizard).
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const has = (m: string) => (AUTH_METHODS as readonly string[]).includes(m);

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

      {has("otp") && (
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
      )}

      {has("magic-link") && (
        <section className="space-y-3">
          <button
            className={btn}
            disabled={!email}
            onClick={async () => {
              await authClient.signIn.magicLink({ email, callbackURL: "/" });
              setMsg("Lien envoyé par email.");
            }}
          >
            Recevoir un lien magique
          </button>
        </section>
      )}

      {has("password") && (
        <section className="space-y-3">
          <input
            className={input}
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
          <div className="flex gap-2">
            <button
              className={btn}
              disabled={!email || password.length < 8}
              onClick={async () => {
                const r = await signIn.email({ email, password });
                setMsg(r.error ? "Échec." : "Connecté.");
                if (!r.error) location.href = "/";
              }}
            >
              Connexion
            </button>
            <button
              className={btn}
              disabled={!email || password.length < 8}
              onClick={async () => {
                const r = await signUp.email({ email, password, name: email.split("@")[0] });
                setMsg(r.error ? "Échec." : "Compte créé.");
                if (!r.error) location.href = "/";
              }}
            >
              Créer un compte
            </button>
          </div>
        </section>
      )}

      {msg && <p className="text-center text-sm text-zinc-500">{msg}</p>}
    </main>
  );
}
