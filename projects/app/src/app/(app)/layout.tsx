import { AppShell } from '@/components/app-shell/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { isPreview } from '@/lib/auth/preview';
import { getSessionUser, requireUserId } from '@/lib/auth/session';

// Zone protégée de la suite : auth requise, enveloppée dans le shell partagé
// (navbar de domaines). Chaque section (cast, media, …) pose sa propre sous-nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  const user = await getSessionUser();
  return (
    <AppShell user={user} preview={isPreview}>
      {children}
      <Toaster />
    </AppShell>
  );
}
