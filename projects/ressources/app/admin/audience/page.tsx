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
        <h1 className="text-4xl font-black tracking-tight">Mon audience</h1>
        <span className="text-sm text-muted-foreground">{members.length.toString().padStart(2, "0")} membre(s)</span>
      </div>

      {members.length === 0 ? (
        <div className="grid place-items-center border border-dashed border-border/40 py-20 text-center">
          <Users className="size-8 text-muted-foreground" strokeWidth={2} />
          <p className="mt-3 font-bold">Personne pour l&apos;instant.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Les visiteurs qui accèdent à tes ressources se rattachent ici automatiquement.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.7rem] text-muted-foreground">
              <th className="pb-2">Utilisateur</th>
              <th className="pb-2">Provenance</th>
              <th className="pb-2 text-right">Depuis</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b border-border/20">
                <td className="py-2">{m.userId}</td>
                <td className="py-2">{m.source ?? "(direct)"}</td>
                <td className="py-2 text-right text-muted-foreground">
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
