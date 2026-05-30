'use client';

import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Lien retour permanent en haut d'une page de création.
export function BackToGallery() {
  return (
    <Link
      href="/media/gallery"
      className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Galerie
    </Link>
  );
}

// Bannière de succès : le média a rejoint la galerie. On propose de la voir ou de
// rester pour en créer d'autres.
export function CreationSuccess({
  message = 'Média ajouté à la galerie.',
  onContinue,
}: {
  message?: string;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-signal" />
      <p className="font-medium text-foreground text-sm">{message}</p>
      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" render={<Link href="/media/gallery" />}>
          Voir la galerie
        </Button>
        <Button size="sm" variant="ghost" onClick={onContinue}>
          Continuer ici
        </Button>
      </div>
    </div>
  );
}
