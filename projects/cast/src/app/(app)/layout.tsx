import { AppHeader } from '@/components/layout/app-header';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();

  return (
    <div className="min-h-screen overflow-x-clip bg-neutral-50">
      <AppHeader authUrl={env.AUTH_URL} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
