import { SignOutButton } from '@/components/sign-out-button';
import { AppShell } from '@/components/ui/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { isPreview } from '@/lib/auth/preview';
import { requireUserId } from '@/lib/auth/session';
import { centralUrl } from '@/lib/central-url';
import { env } from '@/lib/env';
import { castSections } from '../cast-nav';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <AppShell
      project="Cast"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={castSections}
      footer={<SignOutButton preview={isPreview} className="hover:text-foreground" />}
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
