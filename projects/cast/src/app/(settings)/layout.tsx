import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId } from '@/lib/auth/session';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();

  return (
    <div className="flex min-h-screen bg-neutral-100">
      <SettingsSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
