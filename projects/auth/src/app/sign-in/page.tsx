"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient, signIn } from "@/lib/auth-client";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const searchParams = useSearchParams();

  function safeRedirect(): string {
    const raw = searchParams.get("redirect");
    if (!raw) return "/";
    try {
      const u = new URL(raw);
      // Whitelist : domaines de la suite contentos uniquement.
      if (u.hostname === "contentos.ch") return raw;
      if (u.hostname.endsWith(".contentos.ch")) return raw;
      if (u.hostname.endsWith(".preview.contentos.ch")) return raw;
      return "/";
    } catch {
      return "/";
    }
  }

  const redirectParam = searchParams.get("redirect");
  const rq = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : "";
  const isPreviewClient =
    typeof window !== "undefined" && window.location.hostname.endsWith(".preview.contentos.ch");

  // Sur le chooser en preview : pose le marqueur → plus d'auto-login tant qu'il est là.
  useEffect(() => {
    if (isPreviewClient) {
      document.cookie =
        "cos_preview_login=manual; Domain=.preview.contentos.ch; Path=/; Max-Age=31536000; Secure; SameSite=Lax";
    }
  }, [isPreviewClient]);

  const input =
    "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-700";
  const btn =
    "w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <h1 className="text-center text-2xl font-bold tracking-tight">Se connecter</h1>

      {isPreviewClient && (
        <section className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-center text-xs uppercase tracking-wide text-zinc-400">
            Connexion rapide (preview)
          </p>
          <a className={btn + " block text-center"} href={`/preview-login?user=1${rq}`}>
            Entrer comme user1 (operator)
          </a>
          <a className={btn + " block text-center"} href={`/preview-login?user=2${rq}`}>
            Entrer comme user2 (operator)
          </a>
          <a className={btn + " block text-center"} href={`/preview-login?user=3${rq}`}>
            Entrer comme user3 (audience)
          </a>
        </section>
      )}

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
              const r = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
              if (r.error) {
                setMsg(r.error.message ?? "Erreur lors de l'envoi du code.");
                return;
              }
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
                if (r.error) {
                  setMsg(r.error.message ?? "Code invalide.");
                  return;
                }
                setMsg("Connecté.");
                location.href = safeRedirect();
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
