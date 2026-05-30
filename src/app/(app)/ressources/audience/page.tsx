import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/typography';
import { listAudience } from '@/lib/ressources/queries';
import { requireOperator } from '../authz';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audience — Ressources' };

export default async function AudiencePage() {
  const op = await requireOperator();
  const members = await listAudience(op.userId);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <Heading level={1}>Mon audience</Heading>
        <span className="text-muted-foreground text-sm tabular-nums">
          {members.length} membre(s)
        </span>
      </header>

      {members.length === 0 ? (
        <Card className="grid place-items-center border-dashed py-16 text-center">
          <Users className="size-7 text-muted-foreground" strokeWidth={2} />
          <p className="mt-3 font-medium">Personne pour l’instant.</p>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">
            Les lecteurs qui accèdent à tes ressources se rattachent ici automatiquement.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b text-left text-muted-foreground text-xs">
                <th className="px-4 py-2.5 font-semibold">Lecteur</th>
                <th className="px-4 py-2.5 font-semibold">Provenance</th>
                <th className="px-4 py-2.5 text-right font-semibold">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.readerId} className="border-border/40 border-b last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{m.readerId}</td>
                  <td className="px-4 py-2.5">{m.source ?? '(direct)'}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString('fr-CH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
