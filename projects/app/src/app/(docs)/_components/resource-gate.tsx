import { ArrowRight, Lock } from 'lucide-react';
import Link from 'next/link';

// Mur d'accès pour une ressource privée non débloquée. La connexion est in-app
// (/signin) ; on y renvoie avec le chemin de retour.
export function ResourceGate({
  handle,
  title,
  description,
  coverImageUrl,
  backTo,
}: {
  handle: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  backTo: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Link href={`/docs/${handle}`} className="mb-6 inline-block font-black tracking-tight">
          {title ? '←' : ''} Bibliothèque
        </Link>
        <div className="border-2 border-[var(--res-ink)] bg-[var(--res-paper)] shadow-[var(--res-shadow-lg)]">
          {coverImageUrl && (
            <div className="aspect-[16/9] overflow-hidden border-b-2 border-[var(--res-ink)]">
              <img src={coverImageUrl} alt="" className="size-full object-cover" />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <span className="mb-3 inline-flex items-center gap-1.5 border-2 border-[var(--res-ink)] bg-[var(--res-accent)] px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--res-accent-ink)]">
              <Lock className="size-3" strokeWidth={3} /> Accès réservé
            </span>
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            {description && (
              <p className="mt-3 leading-relaxed text-[var(--res-ink-soft)]">{description}</p>
            )}
            <div className="mt-6 border-t-2 border-[var(--res-ink)] pt-6">
              <p className="mb-4 font-bold">Connecte-toi pour accéder à cette ressource.</p>
              <Link
                href={`/signin?redirect=${encodeURIComponent(backTo)}`}
                className="res-press inline-flex items-center gap-2 border-2 border-[var(--res-ink)] bg-[var(--res-accent)] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[var(--res-accent-ink)] shadow-[var(--res-shadow)]"
              >
                Se connecter
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
