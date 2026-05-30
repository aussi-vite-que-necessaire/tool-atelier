import type { ReactNode } from 'react';
import './docs.css';

// Espace public docs (lead magnets publiés). Mise en page propre, distincte de
// l'AppShell de la suite : pas d'auth opérateur, pas de navbar suite. Le wrapper
// .docs-scope porte le thème personnalisable (--res-*) de chaque opérateur.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-scope">{children}</div>;
}
