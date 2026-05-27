import { describe, expect, test } from 'vitest';
import type { CalendarPublication } from '@/lib/calendar/month-grid';
import { buildDashboard } from '@/lib/home/dashboard';

function pub(over: Partial<CalendarPublication>): CalendarPublication {
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
    thumbnailUrl: null,
    ...over,
  } as CalendarPublication;
}

const NOW = new Date('2026-05-15T12:00:00Z');

describe('buildDashboard', () => {
  test('compte planifiés (scheduled + queued) et publiés', () => {
    const { counts } = buildDashboard(
      [
        pub({ status: 'scheduled' }),
        pub({ status: 'queued' }),
        pub({ status: 'published' }),
        pub({ status: 'failed' }),
      ],
      NOW,
    );
    expect(counts).toEqual({ scheduled: 2, published: 1 });
  });

  test('upcoming : seulement le futur, trié par date croissante', () => {
    const { upcoming } = buildDashboard(
      [
        pub({ id: 'past', status: 'scheduled', scheduledFor: new Date('2026-05-10T09:00:00Z') }),
        pub({ id: 'soon', status: 'scheduled', scheduledFor: new Date('2026-05-16T09:00:00Z') }),
        pub({ id: 'later', status: 'queued', scheduledFor: new Date('2026-05-20T09:00:00Z') }),
      ],
      NOW,
    );
    expect(upcoming.map((p) => p.id)).toEqual(['soon', 'later']);
  });

  test('upcoming : borné par la limite', () => {
    const items = Array.from({ length: 8 }, (_, i) =>
      pub({
        id: `s${i}`,
        status: 'scheduled',
        scheduledFor: new Date(`2026-05-${16 + i}T09:00:00Z`),
      }),
    );
    expect(buildDashboard(items, NOW, 3).upcoming).toHaveLength(3);
  });

  test('lastPublished : le plus récent par publishedAt', () => {
    const { lastPublished } = buildDashboard(
      [
        pub({ id: 'old', status: 'published', publishedAt: new Date('2026-05-01T09:00:00Z') }),
        pub({ id: 'recent', status: 'published', publishedAt: new Date('2026-05-12T09:00:00Z') }),
      ],
      NOW,
    );
    expect(lastPublished?.id).toBe('recent');
  });

  test('aucune publication → sections vides', () => {
    const data = buildDashboard([], NOW);
    expect(data.counts).toEqual({ scheduled: 0, published: 0 });
    expect(data.upcoming).toEqual([]);
    expect(data.lastPublished).toBeNull();
  });
});
