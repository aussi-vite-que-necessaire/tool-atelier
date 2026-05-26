import Link from "next/link";

const stack = ["Next.js (App Router)", "Drizzle ORM", "BetterAuth", "Tailwind CSS"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Flagship</h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          La stack de base, prête à déployer.
        </p>
      </div>

      <ul className="flex flex-wrap justify-center gap-2">
        {stack.map((s) => (
          <li
            key={s}
            className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
          >
            {s}
          </li>
        ))}
      </ul>

      <Link
        href="/sign-in"
        className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Se connecter
      </Link>
    </main>
  );
}
