import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/layout/app-header';
import { Toaster } from '@/components/ui/sonner';
import { auth } from '@/lib/auth/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader name={session.user.name ?? null} email={session.user.email} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
}
