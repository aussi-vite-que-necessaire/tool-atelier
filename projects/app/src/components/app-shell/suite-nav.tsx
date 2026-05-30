'use client';

import { Menu } from '@base-ui/react/menu';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import type { SessionUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { MobileDrawer } from './mobile-drawer';
import { activeSegment, SUITE_ENTRIES } from './suite';
import { Wordmark } from './wordmark';

// Barre supérieure de la suite : wordmark à gauche, onglets de domaine au centre,
// menu utilisateur à droite. L'item actif est déduit du premier segment d'URL.
export function SuiteNav({ user, preview }: { user?: SessionUser; preview: boolean }) {
  const pathname = usePathname();
  const active = activeSegment(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <MobileDrawer active={active} />

        <Link href="/cast" aria-label="Accueil de la suite" className="shrink-0">
          <Wordmark />
        </Link>

        <nav
          aria-label="Domaines de la suite"
          className="ml-4 hidden items-stretch gap-0.5 md:flex"
        >
          {SUITE_ENTRIES.map((entry) => {
            const isActive = active === entry.segment;
            return (
              <Link
                key={entry.segment}
                href={`/${entry.segment}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="font-medium">{entry.label}</span>
                {!entry.available && (
                  <span className="eyebrow rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] text-muted-foreground">
                    bientôt
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-signal transition-transform duration-300',
                    isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu user={user} preview={preview} />
        </div>
      </div>
    </header>
  );
}

function initials(name?: string): string {
  if (!name) return '·';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function UserMenu({ user, preview }: { user?: SessionUser; preview: boolean }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-2 pl-1 text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Menu du compte"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-signal text-xs font-semibold text-signal-foreground">
          {initials(user?.name)}
        </span>
        <span className="hidden max-w-32 truncate text-muted-foreground sm:inline">
          {user?.name ?? 'Compte'}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="end" className="z-50">
          <Menu.Popup className="min-w-56 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{user?.name ?? 'Opérateur'}</p>
              {user?.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
            <div className="my-1 h-px bg-border" />
            <Menu.Item
              closeOnClick={false}
              className="rounded-lg text-sm text-muted-foreground outline-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
              render={
                <SignOutButton
                  preview={preview}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5"
                />
              }
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
