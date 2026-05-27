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
      {/* Fond assombri — mobile/tablette uniquement (sur desktop le calendrier reste cliquable) */}
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        onClick={() => router.back()}
        className="fixed inset-0 z-40 bg-black/20 lg:hidden"
      />
      <aside
        aria-label="Aperçu du post"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-in flex-col border-l bg-white shadow-xl duration-200 slide-in-from-right lg:sticky lg:inset-y-auto lg:top-6 lg:right-auto lg:z-auto lg:h-[calc(100vh-3rem)] lg:max-w-none lg:flex-none lg:basis-[440px] lg:rounded-lg lg:border lg:shadow-sm"
      >
        <div className="flex flex-none items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-sm">Aperçu du post</h2>
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Fermer"
            className="rounded p-1 text-muted-foreground hover:bg-neutral-100 hover:text-foreground"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
