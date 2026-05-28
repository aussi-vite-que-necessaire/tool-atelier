import type { CalendarPublication } from '@/lib/calendar/month-grid';

// Statuts considérés comme « à venir » sur le tableau de bord (intention de publication).
const SCHEDULED = new Set(['scheduled', 'queued']);

export type DashboardData = {
  counts: { scheduled: number; published: number };
  upcoming: CalendarPublication[];
  lastPublished: CalendarPublication | null;
};

// Pur : dérive les sections de la home (compteurs, prochains planifiés, dernier publié)
// à partir de la liste des publications enrichies des miniatures.
export function buildDashboard(
  pubs: CalendarPublication[],
  now: Date = new Date(),
  upcomingLimit = 5,
): DashboardData {
  const scheduled = pubs.filter((p) => SCHEDULED.has(p.status));
  const published = pubs.filter((p) => p.status === 'published');

  const upcoming = scheduled
    .filter((p) => p.scheduledFor != null && p.scheduledFor >= now)
    .sort((a, b) => a.scheduledFor!.getTime() - b.scheduledFor!.getTime())
    .slice(0, upcomingLimit);

  const lastPublished =
    published
      .filter((p) => p.publishedAt != null)
      .sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0] ?? null;

  return {
    counts: { scheduled: scheduled.length, published: published.length },
    upcoming,
    lastPublished,
  };
}
