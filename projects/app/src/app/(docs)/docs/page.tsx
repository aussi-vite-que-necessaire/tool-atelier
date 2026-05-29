import { Library } from 'lucide-react';

export const metadata = { title: 'Ressources — Contentos' };

// Racine /docs : l'espace public vit par opérateur (/docs/<handle>). Sans handle,
// on présente une page sobre (le lien public pointe toujours vers un handle).
export default function DocsIndex() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12 text-center">
      <div className="max-w-md">
        <Library className="mx-auto size-10 text-[var(--res-accent)]" strokeWidth={2} />
        <h1 className="mt-4 text-3xl font-black tracking-tight">Espaces de ressources</h1>
        <p className="mt-3 text-[var(--res-ink-soft)]">
          Chaque opérateur publie ses ressources sur son propre espace, à l’adresse{' '}
          <code className="border-2 border-[var(--res-ink)] bg-[var(--res-paper-2)] px-1.5 py-0.5 font-mono text-sm">
            /docs/&lt;handle&gt;
          </code>
          .
        </p>
      </div>
    </main>
  );
}
