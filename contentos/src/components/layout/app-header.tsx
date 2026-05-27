'use client';

import { CalendarDays, FileText, Image as ImageIcon, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth/client';
import { cn } from '@/lib/utils';

const APP_LINKS = [
  { href: '/ideas', label: 'Idées', icon: Lightbulb },
  { href: '/posts', label: 'Posts', icon: FileText },
  { href: '/media', label: 'Galerie', icon: ImageIcon },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
];

export function AppHeader({ name, email }: { name: string | null; email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/signin');
  }

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
            {name?.trim() ? name : email}
          </Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </header>
  );
}
