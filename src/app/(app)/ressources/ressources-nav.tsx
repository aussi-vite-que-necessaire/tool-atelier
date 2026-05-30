'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sous-navigation locale de la section ressources. startsWith pour activer un
// onglet sur ses sous-chemins (ex. /ressources/r/guide active « Ressources »),
// sauf la racine /ressources qui matche exactement.
const RESSOURCES_LINKS = [
  { href: '/ressources', label: 'Bibliothèque', exact: true },
  { href: '/ressources/r', label: 'Ressources', group: '/ressources/r' },
  { href: '/ressources/audience', label: 'Audience' },
  { href: '/ressources/settings', label: 'Réglages' },
];

export function RessourcesNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Navigation ressources"
      className="sticky top-14 z-20 flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6"
    >
      {RESSOURCES_LINKS.map((link) => {
        const base = link.group ?? link.href;
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(base);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {link.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-signal"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
