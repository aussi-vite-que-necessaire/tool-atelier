import { AppShell } from '@/components/ui/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId, signOutUrl } from '@/lib/auth/session';
import { centralUrl } from '@/lib/central-url';
import { env } from '@/lib/env';
import { castSections } from '../cast-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <AppShell
      project="Cast"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={castSections}
      footer={
        <a href={signOutUrl()} className="hover:text-foreground">
          Déconnexion
        </a>
      }
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
