import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-brand-600 sm:text-5xl">auth</h1>
      <p className="text-lg text-zinc-500 dark:text-zinc-400">
        Identity provider central de la suite contentos — SSO partagé entre media, cast,
        ressources… (BetterAuth, session cross-subdomain).
      </p>

      {session?.user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-500">Connecté en tant que {session.user.email}</p>
          <SignOutButton />
        </div>
      ) : (
        <Link
          href="/sign-in"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-500"
        >
          Se connecter
        </Link>
      )}
    </main>
  );
}
