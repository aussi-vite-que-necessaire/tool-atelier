import { cn } from '@/lib/utils';

// Le wordmark de la suite : un point « signal » suivi du nom en serif éditoriale.
// Le point est l'élément mémorable — un repère de couleur unique sur toute l'app.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 select-none', className)}>
      <span aria-hidden className="inline-block size-2 translate-y-[-1px] rounded-full bg-signal" />
      <span className="font-display text-xl leading-none tracking-tight">contentos</span>
    </span>
  );
}
