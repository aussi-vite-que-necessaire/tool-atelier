import { ComingSoon } from '@/components/app-shell/coming-soon';

export const metadata = { title: 'Media — Contentos' };

export default function MediaPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <ComingSoon
        eyebrow="Media"
        title="Des visuels qui tiennent la ligne."
        description="Génération d'images, carrousels, vidéos et exports PDF — pilotés par chartes et templates, prêts à être attachés à tes publications."
      />
    </div>
  );
}
