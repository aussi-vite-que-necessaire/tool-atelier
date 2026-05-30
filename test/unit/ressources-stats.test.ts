import { describe, expect, it } from 'vitest';
import {
  aggregateBySource,
  aggregateResourceStats,
  type SubAttribution,
  type ViewEvent,
} from '@/lib/ressources/stats-aggregate';

describe('aggregateResourceStats', () => {
  it('compte vues, uniques, gate et par page', () => {
    const events: ViewEvent[] = [
      { pageId: 'p1', readerId: 'u1', type: 'page_view' },
      { pageId: 'p1', readerId: 'u1', type: 'page_view' },
      { pageId: 'p2', readerId: 'u2', type: 'page_view' },
      { pageId: null, readerId: 'u3', type: 'gate_view' },
    ];
    const stats = aggregateResourceStats(events, [
      { id: 'p1', title: 'P1', path: [] },
      { id: 'p2', title: 'P2', path: ['p2'] },
    ]);
    expect(stats.totalPageViews).toBe(3);
    expect(stats.uniqueViewers).toBe(2);
    expect(stats.gateImpressions).toBe(1);
    expect(stats.perPage.find((p) => p.pageId === 'p1')!.views).toBe(2);
  });
});

describe('aggregateBySource', () => {
  it('regroupe par source et compte les users uniques', () => {
    const events: ViewEvent[] = [
      { pageId: 'p', readerId: 'u1', type: 'page_view', source: 'linkedin' },
      { pageId: null, readerId: 'u2', type: 'gate_view', source: null },
    ];
    const subs: SubAttribution[] = [
      { readerId: 'u1', source: 'linkedin', campaign: null },
      { readerId: 'u1', source: 'linkedin', campaign: null },
    ];
    const rows = aggregateBySource(events, subs);
    const li = rows.find((r) => r.source === 'linkedin')!;
    expect(li.pageViews).toBe(1);
    expect(li.users).toBe(1);
    expect(rows.find((r) => r.source === '(direct)')!.gateImpressions).toBe(1);
  });
});
