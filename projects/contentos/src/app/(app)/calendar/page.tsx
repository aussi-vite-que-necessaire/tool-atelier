import { requireUserId } from '@/lib/auth/session';
import { buildMonthGrid, parseMonthParam } from '@/lib/calendar/month-grid';
import { listPublicationsForCalendar } from '@/lib/db/repositories/publications';
import { MonthCalendar } from './_components/month-calendar';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParamRaw } = await searchParams;
  const userId = await requireUserId();
  const { year, month } = parseMonthParam(monthParamRaw);
  const pubs = await listPublicationsForCalendar(userId);
  const weeks = buildMonthGrid(year, month, pubs);
  return <MonthCalendar weeks={weeks} year={year} month={month} />;
}
