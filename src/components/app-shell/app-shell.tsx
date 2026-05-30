import type { ReactNode } from 'react';
import type { SessionUser } from '@/lib/auth/session';
import { SuiteNav } from './suite-nav';

// Cadre applicatif de la suite : navbar de domaines en tête, contenu en dessous.
// La garde d'auth vit dans le layout serveur ; le shell est présentationnel et
// reçoit l'identité d'affichage + le drapeau preview.
export function AppShell({
  user,
  preview,
  children,
}: {
  user?: SessionUser;
  preview: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SuiteNav user={user} preview={preview} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
