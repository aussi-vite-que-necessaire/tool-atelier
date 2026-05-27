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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold text-lg capitalize">{label}</h1>
        <div className="flex gap-1">
          <Link
            href={`/calendar?month=${monthParam(p.year, p.month)}`}
            className="rounded border px-2 py-1 text-sm"
            aria-label="Mois précédent"
          >
            ‹
          </Link>
          <Link
            href={`/calendar?month=${monthParam(n.year, n.month)}`}
            className="rounded border px-2 py-1 text-sm"
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
            className="bg-neutral-100 p-2 text-center font-medium text-muted-foreground text-xs"
          >
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => (
          <div
            key={day.date.toISOString()}
            className={`min-h-[150px] space-y-1 p-1.5 ${
              day.inMonth ? 'bg-white' : 'bg-neutral-50 text-muted-foreground'
            }`}
          >
            <div className="text-right text-xs">{day.date.getDate()}</div>
            {day.items.slice(0, 3).map((it) => (
              <Link
                key={it.publicationId}
                href={`/calendar/preview/${it.postId}`}
                className={`flex gap-2 rounded p-1 ${
                  it.status === 'published' ? 'bg-green-50' : 'bg-blue-50'
                }`}
                title={it.excerpt}
              >
                {it.thumbnailUrl ? (
                  <img
                    src={it.thumbnailUrl}
                    alt=""
                    className="h-10 w-10 flex-none rounded object-cover"
                  />
                ) : (
                  <div
                    className={`h-10 w-10 flex-none rounded ${
                      it.status === 'published' ? 'bg-green-200' : 'bg-blue-200'
                    }`}
                  />
                )}
                <span className="line-clamp-2 text-xs leading-tight">{it.excerpt}</span>
              </Link>
            ))}
            {day.items.length > 3 ? (
              <div className="px-1 text-muted-foreground text-xs">+{day.items.length - 3}</div>
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
