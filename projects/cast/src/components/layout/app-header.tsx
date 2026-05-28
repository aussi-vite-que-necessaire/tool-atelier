'use client';

import { CalendarDays, FileText, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const APP_LINKS = [
  { href: '/ideas', label: 'Idées', icon: Lightbulb },
  { href: '/posts', label: 'Posts', icon: FileText },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
];

export function AppHeader({ authUrl }: { authUrl: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold hover:opacity-70">
            Contentos
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-1">
            {APP_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href) ?? false;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm rounded-md',
                    active ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100',
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-sm text-neutral-600 hover:text-neutral-900">
            Réglages
          </Link>
          <a href={authUrl} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Se déconnecter
          </a>
        </div>
      </div>
    </header>
  );
}
