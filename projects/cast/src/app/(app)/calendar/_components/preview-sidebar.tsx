'use client';

import { XIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

export function PreviewSidebar({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = pathname?.startsWith('/calendar/preview/') ?? false;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') router.back();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, router]);

  if (!open) return null;

  return (
    <>
      {/* Fond assombri cliquable — le drawer passe par-dessus le calendrier sur toutes tailles */}
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        onClick={() => router.back()}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <aside
        aria-label="Aperçu du post"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-in flex-col border-l bg-white shadow-xl duration-200 slide-in-from-right"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 rounded-md bg-white/80 p-1.5 text-muted-foreground backdrop-blur hover:bg-neutral-100 hover:text-foreground"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}
