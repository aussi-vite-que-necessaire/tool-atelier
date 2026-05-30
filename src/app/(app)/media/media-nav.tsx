'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sous-navigation locale de la section media. startsWith pour activer un onglet
// sur ses sous-chemins (ex. /media/templates/abc active « Templates »).
const MEDIA_LINKS = [
  { href: '/media/gallery', label: 'Galerie' },
  { href: '/media/templates', label: 'Templates' },
  { href: '/media/styles', label: 'Styles' },
  { href: '/media/style-guides', label: 'Chartes' },
  { href: '/media/brand', label: 'Marque' },
];

export function MediaNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Navigation media"
      className="sticky top-14 z-20 border-b border-border bg-background/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
        {MEDIA_LINKS.map((link) => {
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
      </div>
    </nav>
  );
}
