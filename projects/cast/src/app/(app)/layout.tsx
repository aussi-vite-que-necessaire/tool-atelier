import { AppHeader } from '@/components/layout/app-header';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId, signOutUrl } from '@/lib/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();

  return (
    <div className="min-h-screen overflow-x-clip bg-neutral-50">
      <AppHeader signOutHref={signOutUrl()} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
