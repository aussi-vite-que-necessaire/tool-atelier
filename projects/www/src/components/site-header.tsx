import { headers } from 'next/headers';

import { Button } from '@/components/ui/button';
import { authUrl, getSession, signInUrl } from '@/lib/auth';

// Header partagé. Server component : lit la session côté serveur et adapte le
// coin haut-droite. Déconnecté → « Connexion » ; connecté → Dashboard + email +
// « Se déconnecter » (le provider gère le sign-out via le cookie cross-domain).
export async function SiteHeader() {
  const session = await getSession(await headers());

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
      <a href="/" className="font-heading text-sm font-semibold tracking-tight">
        contentos
      </a>
      <nav className="flex items-center gap-2">
        {session ? (
          <>
            {session.user.email ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" render={<a href={authUrl} />}>
              Se déconnecter
            </Button>
            <Button size="sm" render={<a href="/dashboard" />}>
              Dashboard
            </Button>
          </>
        ) : (
          <Button size="sm" render={<a href={signInUrl()} />}>
            Connexion
          </Button>
        )}
      </nav>
    </header>
  );
}
