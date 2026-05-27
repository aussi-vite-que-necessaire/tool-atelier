import { describe, expect, test } from 'vitest';
import {
  buildMonthGrid,
  calendarDate,
  nextMonth,
  parseMonthParam,
  prevMonth,
} from '@/lib/calendar/month-grid';
import type { Publication } from '@/lib/db/schema';

function pub(over: Partial<Publication>): Publication {
  return {
    id: 'p1',
    userId: 'u',
    postId: 'post1',
    contentSnapshot: 'Mon titre\nsuite',
    mediaKind: null,
    snapshotKeys: null,
    socialAccountId: null,
    platform: 'linkedin',
    status: 'scheduled',
    scheduledFor: null,
    scheduledTz: null,
    publishedAt: null,
    externalPostId: null,
    externalUrl: null,
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    failureKind: null,
    lastError: null,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    updatedAt: new Date('2026-05-01T00:00:00Z'),
    ...over,
  } as Publication;
}

describe('calendarDate', () => {
  test('scheduled → scheduledFor', () => {
    const d = new Date('2026-05-10T09:00:00Z');
    expect(calendarDate(pub({ status: 'scheduled', scheduledFor: d }))).toEqual(d);
  });
  test('published → publishedAt', () => {
    const d = new Date('2026-05-12T09:00:00Z');
    expect(calendarDate(pub({ status: 'published', publishedAt: d }))).toEqual(d);
  });
  test('failed → null', () => {
    expect(calendarDate(pub({ status: 'failed', scheduledFor: new Date() }))).toBeNull();
  });
});

describe('prevMonth / nextMonth', () => {
  test('janvier → décembre année précédente', () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
  test('décembre → janvier année suivante', () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });
});

describe('parseMonthParam', () => {
  test('valide', () => {
    expect(parseMonthParam('2026-05')).toEqual({ year: 2026, month: 5 });
  });
  test('invalide → fallback mois courant', () => {
    const now = new Date();
    expect(parseMonthParam('bogus')).toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });
});

describe('buildMonthGrid', () => {
  test('mai 2026 : semaines de 7 jours, lundi en tête, 1er placé correctement', () => {
    const grid = buildMonthGrid(2026, 5, []);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // 2026-05-01 est un vendredi → première semaine commence lundi 27 avril.
    expect(grid[0]![0]!.date.getDate()).toBe(27);
    expect(grid[0]![0]!.inMonth).toBe(false);
    const may1 = grid[0]!.find((d) => d.inMonth && d.date.getDate() === 1);
    expect(may1).toBeDefined();
  });

  test('place un item planifié au bon jour', () => {
    const grid = buildMonthGrid(2026, 5, [
      pub({ status: 'scheduled', scheduledFor: new Date('2026-05-10T09:00:00Z'), postId: 'pA' }),
    ]);
    const day10 = grid.flat().find((d) => d.inMonth && d.date.getDate() === 10);
    expect(day10?.items).toHaveLength(1);
    expect(day10?.items[0]?.postId).toBe('pA');
    expect(day10?.items[0]?.title).toBe('Mon titre');
  });
});
