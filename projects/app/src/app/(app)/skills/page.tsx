import { ComingSoon } from '@/components/app-shell/coming-soon';

export const metadata = { title: 'Skills — Contentos' };

export default function SkillsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <ComingSoon
        eyebrow="Skills"
        title="Les compétences de tes agents."
        description="Le catalogue des skills agentiques qui orchestrent la suite — à installer, composer et déclencher pour produire du contenu de bout en bout."
      />
    </div>
  );
}
