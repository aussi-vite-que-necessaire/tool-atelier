'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items: { label: string; href: string }[] = [
  { label: 'Brand', href: '/settings/brand' },
  { label: 'Voix', href: '/settings/voice' },
  { label: "Templates d'écriture", href: '/settings/writing-templates' },
  { label: 'Visual styles', href: '/settings/visual-styles' },
  { label: 'Visual templates', href: '/settings/visual-templates' },
  { label: 'Style guides', href: '/settings/style-guides' },
  { label: 'Connexions', href: '/settings/connections' },
];

export function SettingsSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 px-3 py-4">
      <Link href="/" className="px-3 pb-4 text-lg font-semibold">
        content-os
      </Link>
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Réglages
      </p>
      <nav aria-label="Réglages" className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                active
                  ? 'bg-white font-medium text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:bg-white/60',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-4 text-xs text-neutral-500">
        <p className="truncate pb-2">{email}</p>
        <Link href="/" className="hover:text-neutral-900">
          ← Retour à l'app
        </Link>
      </div>
    </aside>
  );
}
