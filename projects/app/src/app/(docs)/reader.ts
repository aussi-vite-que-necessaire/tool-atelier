import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export type Reader = { id: string; email: string };

// Identité du lecteur dans l'espace public docs : session de la suite si présente
// (le lecteur peut être un opérateur connecté), sinon null. Lecture directe, sans
// seed de défauts métier (contrairement à requireUserId côté zone protégée).
export async function getReader(): Promise<Reader | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user?.id) return null;
  return { id: s.user.id, email: s.user.email };
}
