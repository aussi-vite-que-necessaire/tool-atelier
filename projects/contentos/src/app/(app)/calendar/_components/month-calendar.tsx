import Link from 'next/link';
import type { CalendarDay } from '@/lib/calendar/month-grid';
import { monthParam, nextMonth, prevMonth } from '@/lib/calendar/month-grid';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function MonthCalendar({
  weeks,
  year,
  month,
}: {
  weeks: CalendarDay[][];
  year: number;
  month: number;
}) {
  const label = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  const p = prevMonth(year, month);
  const n = nextMonth(year, month);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-2xl capitalize">{label}</h1>
        <div className="flex gap-1.5">
          <Link
            href={`/calendar?month=${monthParam(p.year, p.month)}`}
            className="rounded-md border px-3 py-1.5 hover:bg-neutral-100"
            aria-label="Mois précédent"
          >
            ‹
          </Link>
          <Link
            href={`/calendar?month=${monthParam(n.year, n.month)}`}
            className="rounded-md border px-3 py-1.5 hover:bg-neutral-100"
            aria-label="Mois suivant"
          >
            ›
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        {DAYS.map((d) => (
          <div
            key={d}
            className="bg-neutral-100 p-2.5 text-center font-medium text-muted-foreground text-xs"
          >
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => (
          <div
            key={day.date.toISOString()}
            className={`min-h-[160px] space-y-1.5 p-2 xl:min-h-[200px] ${
              day.inMonth ? 'bg-white' : 'bg-neutral-50 text-muted-foreground'
            }`}
          >
            <div className="text-right text-sm">{day.date.getDate()}</div>
            {day.items.slice(0, 4).map((it) => (
              <Link
                key={it.publicationId}
                href={`/calendar/preview/${it.postId}`}
                className={`flex gap-2 rounded-md p-1.5 transition-colors ${
                  it.status === 'published'
                    ? 'bg-green-50 hover:bg-green-100'
                    : 'bg-blue-50 hover:bg-blue-100'
                }`}
                title={it.excerpt}
              >
                {it.thumbnailUrl ? (
                  <img
                    src={it.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 flex-none rounded object-cover"
                  />
                ) : (
                  <div
                    className={`h-14 w-14 flex-none rounded ${
                      it.status === 'published' ? 'bg-green-200' : 'bg-blue-200'
                    }`}
                  />
                )}
                <span className="line-clamp-3 text-xs leading-snug">{it.excerpt}</span>
              </Link>
            ))}
            {day.items.length > 4 ? (
              <div className="px-1 text-muted-foreground text-xs">+{day.items.length - 4}</div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> planifié
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" /> publié
        </span>
      </div>
    </div>
  );
}
