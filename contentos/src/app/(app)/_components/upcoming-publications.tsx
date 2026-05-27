import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { CalendarPublication } from '@/lib/calendar/month-grid';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Planifié',
  queued: 'En file',
};

function formatWhen(date: Date): string {
  return date.toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function excerpt(snapshot: string): string {
  const text = snapshot.trim().replace(/\s+/g, ' ');
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function UpcomingPublications({ items }: { items: CalendarPublication[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prochains posts planifiés</h2>
        <Link href="/calendar" className="text-sm text-muted-foreground hover:text-foreground">
          Calendrier
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun post planifié pour l’instant.</p>
          <Link href="/calendar" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <CalendarPlus className="size-4" />
            Planifier un post
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-4">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt=""
                  className="size-12 flex-none rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {item.scheduledFor ? formatWhen(item.scheduledFor) : 'Date à définir'}
                  </span>
                  <Badge variant="secondary">{STATUS_LABELS[item.status] ?? item.status}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {excerpt(item.contentSnapshot)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
