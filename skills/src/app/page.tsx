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
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-10 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">skills</h1>
          <p className="mt-1 text-sm text-gray-600">
            Hub des skills agentiques de la suite — contentos, ressources, media.
          </p>
        </div>
        {connected ? (
          <span className="text-xs text-gray-500" title={session?.user?.email ?? ""}>
            connecté
          </span>
        ) : (
          <Link href="/sign-in" className="text-sm underline">
            Se connecter
          </Link>
        )}
      </header>

      {skills.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun skill publié.</p>
      ) : (
        <ul className="space-y-4">
          {skills.map((s) => (
            <li key={s.name} className="border-b border-gray-200 pb-4 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-mono text-sm font-semibold">{s.name}</h2>
                    <span className="font-mono text-xs text-gray-500">v{s.version}</span>
                    <span className="text-xs text-gray-400">· {s.tool}</span>
                  </div>
                  <p className="mt-1 text-sm">{s.tagline}</p>
                  <p className="mt-1 text-xs text-gray-600">{s.description}</p>
                  {s.requires_mcp && s.requires_mcp.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      MCP : <span className="font-mono">{s.requires_mcp.join(", ")}</span>
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {connected ? (
                    <a
                      href={`/api/skills/${s.name}/download`}
                      className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      télécharger
                    </a>
                  ) : (
                    <Link
                      href="/sign-in"
                      className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
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
    </main>
  );
}
