import type { ReactNode } from 'react';
import { RessourcesNav } from './ressources-nav';

// Section ressources : sous-nav locale + conteneur de contenu cadré (calque cast
// et media). L'AppShell + l'auth sont hérités de (app)/layout.tsx.
export default function RessourcesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RessourcesNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </>
  );
}
