import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listSkills } from "@/lib/skills-fs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const skills = await listSkills();
  const connected = !!session;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-12 flex items-baseline justify-between border-b-2 border-brand-900/20 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            skills
          </h1>
          <p className="mt-2 text-sm text-brand-900/70">
            Hub des skills agentiques de la suite AVQN — contentos, ressources, media.
          </p>
        </div>
        <div className="text-right text-xs uppercase tracking-wider text-brand-900/60">
          {connected ? (
            <span title={session?.user?.email ?? ""}>connecté</span>
          ) : (
            <Link href="/sign-in" className="underline hover:text-brand-600">
              se connecter
            </Link>
          )}
        </div>
      </header>

      {skills.length === 0 ? (
        <p className="text-brand-900/60">Aucun skill publié pour l'instant.</p>
      ) : (
        <ul className="space-y-6">
          {skills.map((s) => (
            <li
              key={s.name}
              className="rounded-lg border border-brand-900/15 bg-white/60 p-6 shadow-sm transition hover:shadow-md dark:bg-brand-900/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-3">
                    <h2 className="font-mono text-lg font-semibold text-brand-700">
                      {s.name}
                    </h2>
                    <span className="rounded-full border border-brand-600/40 px-2 py-0.5 font-mono text-xs text-brand-600">
                      v{s.version}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-brand-900/40">
                      {s.tool}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-brand-900">{s.tagline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-brand-900/70">
                    {s.description}
                  </p>
                  {s.requires_mcp && s.requires_mcp.length > 0 && (
                    <p className="mt-3 text-xs text-brand-900/50">
                      Requiert MCP :{" "}
                      {s.requires_mcp.map((m, i) => (
                        <span key={m} className="font-mono">
                          {i > 0 && ", "}
                          {m}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {connected ? (
                    <a
                      href={`/api/skills/${s.name}/download`}
                      className="inline-flex items-center gap-2 rounded-md border-2 border-brand-700 bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      télécharger
                    </a>
                  ) : (
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center gap-2 rounded-md border-2 border-brand-900/30 px-4 py-2 text-sm font-semibold text-brand-900/60 hover:border-brand-700 hover:text-brand-700"
                    >
                      se connecter
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-16 border-t border-brand-900/15 pt-6 text-center text-xs text-brand-900/40">
        atelier · skills hub
      </footer>
    </main>
  );
}
