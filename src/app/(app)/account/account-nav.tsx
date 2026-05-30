'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sous-navigation locale de l'espace Compte. Un onglet aujourd'hui (Connexions) ;
// d'autres viendront (Profil, …). Règle d'activité par startsWith.
const ACCOUNT_LINKS = [
  { href: '/account/voices', label: 'Voix' },
  { href: '/account/connections', label: 'Connexions' },
];

export function AccountNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Navigation compte"
      className="sticky top-14 z-20 flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6"
    >
      {ACCOUNT_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
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
