import type { ReactNode } from 'react';
import { CastNav } from './cast-nav';

// Section cast : sous-nav locale + conteneur de contenu cadré. Les vues
// plein-cadre (calendrier) se positionnent en `fixed` et débordent ce conteneur.
export default function CastLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CastNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </>
  );
}
