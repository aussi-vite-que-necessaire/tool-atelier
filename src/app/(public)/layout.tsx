import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/app-shell/wordmark';
import { buttonVariants } from '@/components/ui/button';

// Coque publique (landing, styleguide) — distincte de l'AppShell : pas d'auth,
// en-tête minimal et pied de page léger. Le canevas reste le papier de la suite.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Contentos">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/styleguide"
              className="hidden px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Design system
            </Link>
            <Link href="/signin" className={buttonVariants({ variant: 'default', size: 'lg' })}>
              Se connecter
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-8">
          <Wordmark className="opacity-80" />
          <p className="eyebrow text-[0.6875rem]">
            Suite de production de contenu · piloté par agents
          </p>
        </div>
      </footer>
    </div>
  );
}
