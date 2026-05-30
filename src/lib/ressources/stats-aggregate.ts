export type ViewEvent = {
  pageId: string | null;
  readerId: string | null;
  type: 'page_view' | 'gate_view';
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};
export type StatPage = { id: string; title: string; path: string[] };

export type ResourceStats = {
  totalPageViews: number;
  uniqueViewers: number;
  gateImpressions: number;
  perPage: { pageId: string; title: string; path: string[]; views: number }[];
};

export function aggregateResourceStats(events: ViewEvent[], pages: StatPage[]): ResourceStats {
  const pageViews = events.filter((e) => e.type === 'page_view');
  const gateViews = events.filter((e) => e.type === 'gate_view');

  const uniq = new Set(pageViews.map((e) => e.readerId).filter((u): u is string => u !== null));

  const counts = new Map<string, number>();
  for (const e of pageViews) {
    if (e.pageId) counts.set(e.pageId, (counts.get(e.pageId) ?? 0) + 1);
  }

  return {
    totalPageViews: pageViews.length,
    uniqueViewers: uniq.size,
    gateImpressions: gateViews.length,
    perPage: pages.map((p) => ({
      pageId: p.id,
      title: p.title,
      path: p.path,
      views: counts.get(p.id) ?? 0,
    })),
  };
}

export type SubAttribution = {
  readerId: string;
  source: string | null;
  medium?: string | null;
  campaign: string | null;
};

export type SourceRow = {
  source: string;
  pageViews: number;
  gateImpressions: number;
  users: number;
};

const DIRECT = '(direct)';

export function aggregateBySource(events: ViewEvent[], subs: SubAttribution[]): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  const row = (s: string | null | undefined) => {
    const key = s ?? DIRECT;
    let r = rows.get(key);
    if (!r) {
      r = { source: key, pageViews: 0, gateImpressions: 0, users: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const e of events) {
    const r = row(e.source);
    if (e.type === 'page_view') r.pageViews++;
    else if (e.type === 'gate_view') r.gateImpressions++;
  }
  const seen = new Set<string>();
  for (const s of subs) {
    const k = `${s.source ?? DIRECT}::${s.readerId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    row(s.source).users++;
  }
  return [...rows.values()].sort((a, b) => b.users - a.users || b.pageViews - a.pageViews);
}
