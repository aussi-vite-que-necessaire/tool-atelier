import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { auth } from '@/lib/auth/server';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <SettingsSidebar email={session.user.email} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
