import { ComingSoon } from '@/components/app-shell/coming-soon';

export const metadata = { title: 'Ressources — Contentos' };

export default function RessourcesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <ComingSoon
        eyebrow="Ressources"
        title="Ta matière première, au même endroit."
        description="Une bibliothèque éditoriale — sources, idées, références et briefs — dans laquelle tes agents puisent pour nourrir chaque contenu."
      />
    </div>
  );
}
