import { Users } from "lucide-react"
import { requireOperator } from "@/lib/auth/operator"
import { listAudience } from "@/lib/content/queries"

export const dynamic = "force-dynamic"

export default async function AudiencePage() {
  const op = await requireOperator()
  const members = await listAudience(op.id)

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="accent-rule text-4xl font-black tracking-tight">Mon audience</h1>
        <span className="font-mono text-sm text-ink-soft">{members.length.toString().padStart(2, "0")} membre(s)</span>
      </div>

      {members.length === 0 ? (
        <div className="grid place-items-center border-2 border-dashed border-ink/40 py-20 text-center">
          <Users className="size-8 text-ink-soft" strokeWidth={2} />
          <p className="mt-3 font-bold">Personne pour l&apos;instant.</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            Les visiteurs qui accèdent à tes ressources se rattachent ici automatiquement.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left font-mono text-[0.7rem] uppercase tracking-wide text-ink-soft">
              <th className="pb-2">Utilisateur</th>
              <th className="pb-2">Provenance</th>
              <th className="pb-2 text-right">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b border-ink/20">
                <td className="py-2 font-mono">{m.userId}</td>
                <td className="py-2">{m.source ?? "(direct)"}</td>
                <td className="py-2 text-right font-mono text-ink-soft">
                  {new Date(m.createdAt).toLocaleDateString("fr-CH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
