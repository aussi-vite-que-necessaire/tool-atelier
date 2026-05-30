'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Menu as MenuIcon, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SUITE_ENTRIES } from './suite';
import { Wordmark } from './wordmark';

// Drawer mobile : mêmes domaines que la navbar, ouvert depuis le hamburger.
// Un clic sur un lien navigue et referme le tiroir.
export function MobileDrawer({ active }: { active: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="-ml-1.5 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
        aria-label="Ouvrir la navigation"
      >
        <MenuIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[open]:animate-in data-[open]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0 md:hidden" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground outline-none data-[open]:animate-in data-[open]:slide-in-from-left data-[closed]:animate-out data-[closed]:slide-out-to-left md:hidden">
          <div className="flex items-center justify-between">
            <Wordmark />
            <Dialog.Close
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Navigation de la suite</Dialog.Title>
          <nav className="mt-7 flex flex-col gap-1">
            {SUITE_ENTRIES.map((entry) => {
              const isActive = active === entry.segment;
              return (
                <Link
                  key={entry.segment}
                  href={`/${entry.segment}`}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'hover:bg-sidebar-accent/60',
                  )}
                >
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {isActive && <span className="size-1.5 rounded-full bg-signal" />}
                      {entry.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{entry.tagline}</span>
                  </span>
                  {!entry.available && (
                    <span className="eyebrow text-[0.6rem] text-muted-foreground">bientôt</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
