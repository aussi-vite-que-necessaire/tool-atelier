import type { Publication } from '@/lib/db/schema';

export type CalendarItem = {
  publicationId: string;
  postId: string;
  title: string;
  status: string;
};
export type CalendarDay = { date: Date; inMonth: boolean; items: CalendarItem[] };

const SCHEDULED = new Set(['scheduled', 'queued', 'publishing']);

export function calendarDate(pub: Publication): Date | null {
  if (SCHEDULED.has(pub.status)) return pub.scheduledFor ?? null;
  if (pub.status === 'published') return pub.publishedAt ?? null;
  return null;
}

function title(snapshot: string): string {
  const firstLine = snapshot.split('\n')[0] ?? '';
  return firstLine.length > 40 ? `${firstLine.slice(0, 39)}…` : firstLine;
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthParam(s: string | undefined): { year: number; month: number } {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// Clé jour locale (YYYY-M-D) pour regrouper les items.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildMonthGrid(year: number, month: number, pubs: Publication[]): CalendarDay[][] {
  const byDay = new Map<string, CalendarItem[]>();
  for (const p of pubs) {
    const d = calendarDate(p);
    if (!d) continue;
    const key = dayKey(d);
    const item: CalendarItem = {
      publicationId: p.id,
      postId: p.postId,
      title: title(p.contentSnapshot),
      status: p.status,
    };
    const arr = byDay.get(key);
    if (arr) arr.push(item);
    else byDay.set(key, [item]);
  }

  const first = new Date(year, month - 1, 1);
  // getDay : 0=dim … 6=sam → on veut lundi=0.
  const offset = (first.getDay() + 6) % 7;
  const cursor = new Date(year, month - 1, 1 - offset);

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor);
      const items = (byDay.get(dayKey(date)) ?? []).sort((a, b) => a.title.localeCompare(b.title));
      week.push({ date, inMonth: date.getMonth() === month - 1, items });
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.every((d) => !d.inMonth) && weeks.length >= 4) break;
    weeks.push(week);
  }
  return weeks;
}
