# Spec 10 — Calendrier éditorial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page `/calendar` (grille mois) montrant publications planifiées + publiées, chaque entrée liée au post. Lecture seule.

**Architecture:** Fonction pure `buildMonthGrid` testée en unit ; page server-rendered ; navigation mois par lien `?month=YYYY-MM`. Aucune migration, aucune lib de date.

**Tech Stack:** Next.js App Router (server component), Drizzle, lucide-react, Vitest, Playwright.

---

## Task 1 : Logique pure `month-grid.ts`

**Files:**
- Create: `src/lib/calendar/month-grid.ts`
- Test: `test/unit/month-grid.test.ts`

- [ ] **Step 1 : Tests qui échouent**

```ts
// test/unit/month-grid.test.ts
import { describe, expect, test } from 'vitest';
import type { Publication } from '@/lib/db/schema';
import {
  buildMonthGrid,
  calendarDate,
  nextMonth,
  parseMonthParam,
  prevMonth,
} from '@/lib/calendar/month-grid';

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
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npm run test:unit -- month-grid`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `month-grid.ts`**

```ts
// src/lib/calendar/month-grid.ts
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

export function buildMonthGrid(
  year: number,
  month: number,
  pubs: Publication[],
): CalendarDay[][] {
  // Regroupe les items par jour.
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
  const start = new Date(year, month - 1, 1 - offset);

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(start);
  // Assez de semaines pour couvrir le mois (5 ou 6).
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor);
      const items = (byDay.get(dayKey(date)) ?? []).sort(
        (a, b) => a.title.localeCompare(b.title),
      );
      week.push({ date, inMonth: date.getMonth() === month - 1, items });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // Stop après avoir dépassé le mois (la semaine courante ne contient plus
    // aucun jour du mois et on a au moins 4 semaines).
    if (week.every((d) => !d.inMonth) && weeks.length >= 4) {
      weeks.pop();
      break;
    }
  }
  return weeks;
}
```

> Note : le tri des items par jour est par titre ici (déterministe pour les tests). Si tu préfères trier par heure, remplace par `calendarDate`.

- [ ] **Step 4 : Lancer → passe**

Run: `npm run test:unit -- month-grid`
Expected: PASS. (Si une assertion de bornes échoue, ajuster la logique de coupe de semaines, pas le test conceptuel.)

- [ ] **Step 5 : Commit**

```bash
git add src/lib/calendar/month-grid.ts test/unit/month-grid.test.ts
git commit -m "🤖 feat(spec-10): logique pure grille calendrier mensuelle"
```

---

## Task 2 : Page `/calendar` + chips

**Files:**
- Create: `src/app/(app)/calendar/page.tsx`
- Create: `src/app/(app)/calendar/_components/month-calendar.tsx`

- [ ] **Step 1 : Composant de rendu `month-calendar.tsx`**

Server component (pas de `'use client'`) qui reçoit `weeks: CalendarDay[][]`, `year`, `month`, et rend :
- en-tête : libellé mois (`new Date(year, month-1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })`) + deux `<Link>` ‹ › vers `?month=` calculés via `prevMonth`/`nextMonth` + `monthParam` ;
- ligne d'en-tête des 7 jours (Lun…Dim) ;
- grille : pour chaque semaine, 7 cellules. Cellule = numéro du jour (classe atténuée si `!inMonth`), puis jusqu'à 3 chips. Chip = `<Link href={'/posts/' + item.postId}>` avec le `title`, style selon `status` (planifié : neutre/bleu ; publié : vert). Si `items.length > 3` → `+{items.length - 3}`.

```tsx
// src/app/(app)/calendar/_components/month-calendar.tsx
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
          <Link href={`/calendar?month=${monthParam(p.year, p.month)}`} className="rounded border px-2 py-1 text-sm">
            ‹
          </Link>
          <Link href={`/calendar?month=${monthParam(n.year, n.month)}`} className="rounded border px-2 py-1 text-sm">
            ›
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        {DAYS.map((d) => (
          <div key={d} className="bg-neutral-100 p-2 text-center font-medium text-muted-foreground text-xs">
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => (
          <div
            key={day.date.toISOString()}
            className={`min-h-[6rem] space-y-1 bg-white p-1.5 ${day.inMonth ? '' : 'bg-neutral-50 text-muted-foreground'}`}
          >
            <div className="text-right text-xs">{day.date.getDate()}</div>
            {day.items.slice(0, 3).map((it) => (
              <Link
                key={it.publicationId}
                href={`/posts/${it.postId}`}
                className={`block truncate rounded px-1 py-0.5 text-xs ${
                  it.status === 'published'
                    ? 'bg-green-100 text-green-900'
                    : 'bg-blue-100 text-blue-900'
                }`}
                title={it.title}
              >
                {it.title}
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
```

- [ ] **Step 2 : Page `page.tsx`**

```tsx
// src/app/(app)/calendar/page.tsx
import { requireUserId } from '@/lib/auth/session';
import { buildMonthGrid, parseMonthParam } from '@/lib/calendar/month-grid';
import { listPublications } from '@/lib/db/repositories/publications';
import { MonthCalendar } from './_components/month-calendar';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParamRaw } = await searchParams;
  const userId = await requireUserId();
  const { year, month } = parseMonthParam(monthParamRaw);
  const pubs = await listPublications(userId);
  const weeks = buildMonthGrid(year, month, pubs);
  return <MonthCalendar weeks={weeks} year={year} month={month} />;
}
```

- [ ] **Step 3 : Build**

Run: `npm run build`
Expected: route `/calendar` compile.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(app)/calendar/page.tsx" "src/app/(app)/calendar/_components/month-calendar.tsx"
git commit -m "🤖 feat(spec-10): page /calendar (grille mois, chips liées aux posts)"
```

---

## Task 3 : Lien de navigation « Calendrier »

**Files:**
- Modify: `src/components/layout/app-header.tsx`

- [ ] **Step 1 : Ajouter le lien**

Importer `CalendarDays` depuis `lucide-react` et ajouter au tableau `APP_LINKS` :

```ts
import { CalendarDays, FileText, Image as ImageIcon, Lightbulb } from 'lucide-react';
// …
const APP_LINKS = [
  { href: '/ideas', label: 'Idées', icon: Lightbulb },
  { href: '/posts', label: 'Posts', icon: FileText },
  { href: '/media', label: 'Galerie', icon: ImageIcon },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
];
```

- [ ] **Step 2 : tsc + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3 : Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "🤖 feat(spec-10): lien Calendrier dans la nav"
```

---

## Task 4 : E2E

**Files:**
- Create: `test/e2e/calendar.spec.ts`

- [ ] **Step 1 : Écrire le test (stub LinkedIn)**

Réutiliser les helpers `signup`, `connectLinkedIn`, `createPost` (copiés/adaptés de `test/e2e/linkedin-publish.spec.ts`). Flux :
1. signup + connecter LinkedIn (stub) ;
2. créer un post ;
3. le planifier à une date du mois courant (ex. le 28 à 10:00 — calculer un jour futur du mois courant, sinon basculer au mois suivant) ;
4. aller sur `/calendar` (mois courant) ;
5. attendre qu'une chip avec le titre du post soit visible ;
6. cliquer la chip → vérifier l'URL `/posts/...`.

Pour fiabiliser la date : choisir `scheduledFor` dans le mois courant à une heure future ; si on est en fin de mois, naviguer via `?month=` au mois de la date planifiée.

- [ ] **Step 2 : Lancer**

Run: `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"; CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e -- test/e2e/calendar.spec.ts`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
git add test/e2e/calendar.spec.ts
git commit -m "🤖 test(spec-10): e2e planifier puis voir dans le calendrier (stub)"
```

---

## Task 5 : Validation finale + PR

- [ ] **Step 1 : Suite complète** — `npm run db:test:prepare && npm test` → tous verts.
- [ ] **Step 2 : Lint + format + tsc** — `npx biome check --write . && npm run lint && npx tsc --noEmit` → clean.
- [ ] **Step 3 : E2E complète** — `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"; CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e` → tous verts.
- [ ] **Step 4 : Push + PR (ne pas merger)** — `git push -u origin spec-10/calendar` puis `gh pr create`.
- [ ] **Step 5 : Surveiller CI vert**, puis rendre la main pour validation du merge.
