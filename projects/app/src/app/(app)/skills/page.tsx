import { Download, Puzzle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { listSkills, type SkillManifest } from '@/lib/skills/catalog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Skills — Contentos' };

// Étiquette lisible par domaine — reprend les sections de la suite.
const TOOL_LABEL: Record<string, string> = {
  suite: 'Suite',
  cast: 'Cast',
  media: 'Media',
  ressources: 'Ressources',
};

function SkillCard({ skill, index }: { skill: SkillManifest; index: number }) {
  return (
    <Card className="rise-in gap-0 p-0" style={{ animationDelay: `${0.05 * index + 0.1}s` }}>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono font-semibold text-foreground text-sm tracking-tight">
              {skill.name}
            </code>
            <span className="font-mono text-muted-foreground text-xs">v{skill.version}</span>
            <Badge variant="outline" className="font-mono">
              {TOOL_LABEL[skill.tool] ?? skill.tool}
            </Badge>
          </div>

          <p className="mt-3 font-display text-foreground text-lg leading-snug">{skill.tagline}</p>
          <p className="mt-2 max-w-prose text-muted-foreground text-sm leading-relaxed">
            {skill.description}
          </p>

          {skill.requires_mcp && skill.requires_mcp.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="eyebrow text-muted-foreground">MCP</span>
              {skill.requires_mcp.map((m) => (
                <Badge key={m} variant="secondary" className="font-mono">
                  {m}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <a
          href={`/skills/${skill.name}/download`}
          className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-md bg-foreground px-3.5 font-medium text-background text-sm transition-colors hover:bg-foreground/85"
        >
          <Download className="size-4" strokeWidth={2.25} />
          Télécharger
        </a>
      </div>
    </Card>
  );
}

export default async function SkillsPage() {
  const skills = await listSkills();

  return (
    <div className="mx-auto w-full max-w-3xl px-1 pb-16 sm:px-0">
      <header className="rise-in relative isolate overflow-hidden py-12 sm:py-16">
        <div className="hairline-grid pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <span className="eyebrow flex items-center gap-2 text-signal">
          <span className="size-1.5 rounded-full bg-signal" />
          Skills
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[0.98] tracking-tight sm:text-5xl">
          Le cerveau de tes agents.
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground leading-relaxed">
          Le catalogue des skills agentiques de la suite — modes d'emploi embarqués qui pilotent
          cast, media et ressources via MCP. Télécharge-les et installe-les dans ton agent.
        </p>
      </header>

      {skills.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Puzzle className="size-7 text-muted-foreground" strokeWidth={1.75} />
          <p className="text-muted-foreground text-sm">Aucun skill publié pour l'instant.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {skills.map((skill, i) => (
            <SkillCard key={skill.name} skill={skill} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
