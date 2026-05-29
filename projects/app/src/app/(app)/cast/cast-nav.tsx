'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sous-navigation locale de la section cast. La règle d'activité tolère les
// sous-chemins (ex. /cast/posts/123 active « Posts ») via startsWith, sauf pour
// la racine /cast qui doit matcher exactement.
const CAST_LINKS = [
  { href: '/cast', label: 'Accueil', exact: true },
  { href: '/cast/posts', label: 'Posts' },
  { href: '/cast/calendar', label: 'Calendrier' },
  { href: '/cast/settings/voice', label: 'Réglages', group: '/cast/settings' },
];

export function CastNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Navigation cast"
      className="sticky top-14 z-20 flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6"
    >
      {CAST_LINKS.map((link) => {
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
