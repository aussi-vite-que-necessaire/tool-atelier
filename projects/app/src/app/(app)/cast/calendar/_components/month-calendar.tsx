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
    <div className="flex h-full flex-col">
      <div className="flex flex-none items-center justify-between gap-2 border-b px-3 py-2">
        <span className="font-medium text-sm capitalize">{label}</span>
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/cast/calendar?month=${monthParam(p.year, p.month)}`}
            className="rounded-md border px-2.5 py-1 hover:bg-neutral-100"
            aria-label="Mois précédent"
          >
            ‹
          </Link>
          <Link
            href={`/cast/calendar?month=${monthParam(n.year, n.month)}`}
            className="rounded-md border px-2.5 py-1 hover:bg-neutral-100"
            aria-label="Mois suivant"
          >
            ›
          </Link>
          <Link
            href="/cast/calendar"
            className="rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-neutral-100 hover:text-foreground"
          >
            Aujourd'hui
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="grid min-h-full grid-cols-7 gap-px bg-border text-sm"
          style={{ gridTemplateRows: `auto repeat(${weeks.length}, minmax(120px, 1fr))` }}
        >
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
              className={`flex min-h-0 flex-col gap-1.5 overflow-hidden p-2 ${
                day.inMonth ? 'bg-white' : 'bg-neutral-50 text-muted-foreground'
              }`}
            >
              <div className="flex-none text-right text-sm">{day.date.getDate()}</div>
              {day.items.slice(0, 4).map((it) => (
                <Link
                  key={it.publicationId}
                  href={`/cast/calendar/preview/${it.postId}`}
                  className={`flex flex-none gap-2 rounded-md p-1.5 transition-colors ${
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
                      className="h-12 w-12 flex-none rounded object-cover"
                    />
                  ) : (
                    <div
                      className={`h-12 w-12 flex-none rounded ${
                        it.status === 'published' ? 'bg-green-200' : 'bg-blue-200'
                      }`}
                    />
                  )}
                  <span className="line-clamp-3 text-xs leading-snug">{it.excerpt}</span>
                </Link>
              ))}
              {day.items.length > 4 ? (
                <div className="flex-none px-1 text-muted-foreground text-xs">
                  +{day.items.length - 4}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
