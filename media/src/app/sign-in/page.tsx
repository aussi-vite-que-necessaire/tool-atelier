"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // callbackURL "/" : BetterAuth reprend la requête OAuth en attente après authentification.
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
      if (error) setError(error.message ?? "Erreur lors de l'envoi du lien");
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Connexion à media</h1>
      {sent ? (
        <p className="text-sm text-gray-600">
          Lien envoyé à {email}. Vérifie ta boîte mail (valable 10 min).
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
          <button
            type="submit"
            disabled={loading || !email}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Envoi…" : "Recevoir le lien"}
          </button>
        </form>
      )}
    </main>
  );
}
