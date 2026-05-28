import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './server';

/**
 * Récupère le userId de la session courante (Server Component / Server Action).
 * Redirige vers /signin si pas de session active.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');
  return session.user.id;
}

/**
 * Variante non-redirigeante. Retourne undefined si pas de session.
 * Utiliser dans les contextes où on veut gérer l'absence soi-même.
 */
export async function getUserId(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}
