# Calendrier enrichi + aperçu LinkedIn — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrandir la vue calendrier (miniature + 2 lignes par post) et offrir un aperçu LinkedIn fidèle, ouvert en modale (route interceptée) et réutilisé en aperçu live dans l'éditeur.

**Architecture:** Un composant présentationnel `LinkedInPostPreview` sans I/O, alimenté par un helper d'identité serveur (`getAuthorIdentity`). Le calendrier enrichit ses items (`excerpt`, `thumbnailUrl`) via une requête repo jointe, et chaque item lie vers `/calendar/preview/[postId]` interceptée en modale. Le même composant sert d'aperçu live dans l'éditeur de post.

**Tech Stack:** Next.js 16 (App Router, parallel/intercepting routes), React client components, Drizzle (pg), shadcn Dialog, Vitest (unit/integration), Playwright (e2e), Biome (lint).

**Spec:** `docs/superpowers/specs/2026-05-27-calendar-linkedin-preview-design.md`

---

## Structure des fichiers

**Créés :**
- `src/lib/linkedin/identity.ts` — `resolveAuthor` (pur) + `getAuthorIdentity` (serveur).
- `src/components/linkedin/post-text.tsx` — `'use client'`, repli « voir plus ».
- `src/components/linkedin/post-preview.tsx` — composant présentationnel.
- `src/app/(app)/calendar/layout.tsx` — slot parallèle `@modal`.
- `src/app/(app)/calendar/@modal/default.tsx` — `null`.
- `src/app/(app)/calendar/@modal/(.)preview/[postId]/page.tsx` — version interceptée (modale).
- `src/app/(app)/calendar/preview/[postId]/page.tsx` — version pleine page.
- `src/app/(app)/calendar/_components/post-preview-pane.tsx` — serveur, charge données + rend l'aperçu.
- `src/app/(app)/calendar/_components/preview-dialog.tsx` — `'use client'`, enveloppe Dialog.
- `test/unit/linkedin-identity.test.ts` — tests de `resolveAuthor`.

**Modifiés :**
- `src/lib/calendar/month-grid.ts` — `CalendarItem` enrichi (`excerpt`, `thumbnailUrl`), type `CalendarPublication`, helper `excerpt`.
- `src/lib/db/repositories/publications.ts` — `listPublicationsForCalendar` (join thumbnail).
- `src/app/(app)/calendar/page.tsx` — utilise `listPublicationsForCalendar`.
- `src/app/(app)/calendar/_components/month-calendar.tsx` — cases agrandies, item miniature + 2 lignes, lien vers la modale.
- `src/app/(app)/posts/[id]/page.tsx` — calcule l'identité, la passe à l'éditeur.
- `src/app/(app)/posts/[id]/_components/post-editor.tsx` — panneau d'aperçu live.
- `test/unit/month-grid.test.ts` — assertions sur `excerpt`/`thumbnailUrl`.
- `test/integration/publications-repository.test.ts` — test de `listPublicationsForCalendar`.
- `test/e2e/calendar.spec.ts` — flux modale + « voir plus » + bouton Modifier.

---

## Task 1: Identité de l'auteur (`resolveAuthor` + `getAuthorIdentity`)

**Files:**
- Create: `src/lib/linkedin/identity.ts`
- Test: `test/unit/linkedin-identity.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`test/unit/linkedin-identity.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { resolveAuthor } from '@/lib/linkedin/identity';

describe('resolveAuthor', () => {
  test('priorité au displayName LinkedIn', () => {
    const a = resolveAuthor({
      displayName: 'Manu AVQN',
      brandName: 'AVQN',
      userName: 'manu',
    });
    expect(a.name).toBe('Manu AVQN');
  });

  test('repli sur brandName puis userName puis défaut', () => {
    expect(resolveAuthor({ brandName: 'AVQN' }).name).toBe('AVQN');
    expect(resolveAuthor({ userName: 'manu' }).name).toBe('manu');
    expect(resolveAuthor({}).name).toBe('Vous');
  });

  test('headline = brandSignature si présent, sinon absent', () => {
    expect(resolveAuthor({ displayName: 'X', brandSignature: 'Fondateur' }).headline).toBe(
      'Fondateur',
    );
    expect(resolveAuthor({ displayName: 'X' }).headline).toBeUndefined();
  });

  test('avatarUrl = brandLogoUrl si présent, sinon absent', () => {
    expect(
      resolveAuthor({ displayName: 'X', brandLogoUrl: 'https://img/logo.png' }).avatarUrl,
    ).toBe('https://img/logo.png');
    expect(resolveAuthor({ displayName: 'X' }).avatarUrl).toBeUndefined();
  });

  test('ignore les chaînes vides / espaces', () => {
    const a = resolveAuthor({ displayName: '   ', brandName: 'AVQN', brandSignature: '  ' });
    expect(a.name).toBe('AVQN');
    expect(a.headline).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx vitest run --project=unit test/unit/linkedin-identity.test.ts`
Expected: FAIL (`resolveAuthor` introuvable / module manquant).

- [ ] **Step 3: Implémenter `identity.ts`**

`src/lib/linkedin/identity.ts` :

```ts
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getSettings } from '@/lib/db/repositories/settings';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { user } from '@/lib/db/schema';

export type LinkedInAuthor = { name: string; headline?: string; avatarUrl?: string };

type ResolveInput = {
  displayName?: string | null;
  brandName?: string | null;
  brandSignature?: string | null;
  brandLogoUrl?: string | null;
  userName?: string | null;
};

function clean(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
}

// Pur : reconstitue l'identité affichée à partir des sources disponibles.
export function resolveAuthor(input: ResolveInput): LinkedInAuthor {
  const name = clean(input.displayName) ?? clean(input.brandName) ?? clean(input.userName) ?? 'Vous';
  const author: LinkedInAuthor = { name };
  const headline = clean(input.brandSignature);
  if (headline) author.headline = headline;
  const avatarUrl = clean(input.brandLogoUrl);
  if (avatarUrl) author.avatarUrl = avatarUrl;
  return author;
}

// Charge l'identité réelle de l'utilisateur (compte LinkedIn + marque + nom).
export async function getAuthorIdentity(userId: string): Promise<LinkedInAuthor> {
  const [account, settings, rows] = await Promise.all([
    getSocialAccount(userId, 'linkedin'),
    getSettings(userId),
    db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1),
  ]);
  return resolveAuthor({
    displayName: account?.displayName,
    brandName: settings?.brandName,
    brandSignature: settings?.brandSignature,
    brandLogoUrl: settings?.brandLogoUrl,
    userName: rows[0]?.name,
  });
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `npx vitest run --project=unit test/unit/linkedin-identity.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/linkedin/identity.ts test/unit/linkedin-identity.test.ts
git commit -m "✨ identité LinkedIn : resolveAuthor + getAuthorIdentity"
```

---

## Task 2: Enrichir `month-grid` (`excerpt` + `thumbnailUrl`)

**Files:**
- Modify: `src/lib/calendar/month-grid.ts`
- Test: `test/unit/month-grid.test.ts`

- [ ] **Step 1: Mettre à jour le test (échec attendu)**

Dans `test/unit/month-grid.test.ts`, modifier le helper `pub` pour produire une `CalendarPublication` (ajouter `thumbnailUrl`), et remplacer les assertions `title` par `excerpt` + ajouter `thumbnailUrl`. Remplacer l'import et le helper :

```ts
import type { CalendarPublication } from '@/lib/calendar/month-grid';

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
```

Et remplacer le test « place un item planifié au bon jour » par :

```ts
  test('place un item planifié au bon jour avec excerpt + miniature', () => {
    const grid = buildMonthGrid(2026, 5, [
      pub({
        status: 'scheduled',
        scheduledFor: new Date('2026-05-10T09:00:00Z'),
        postId: 'pA',
        contentSnapshot: 'Première ligne\nDeuxième ligne\nTroisième ligne',
        thumbnailUrl: 'https://img/thumb.png',
      }),
    ]);
    const day10 = grid.flat().find((d) => d.inMonth && d.date.getDate() === 10);
    expect(day10?.items).toHaveLength(1);
    expect(day10?.items[0]?.postId).toBe('pA');
    expect(day10?.items[0]?.excerpt).toBe('Première ligne\nDeuxième ligne');
    expect(day10?.items[0]?.thumbnailUrl).toBe('https://img/thumb.png');
  });
```

- [ ] **Step 2: Lancer → échec attendu**

Run: `npx vitest run --project=unit test/unit/month-grid.test.ts`
Expected: FAIL (type `CalendarPublication` inexistant, `excerpt` absent).

- [ ] **Step 3: Modifier `month-grid.ts`**

Remplacer le bloc de types + le helper `title` + l'assemblage de l'item.

Types (remplacer `CalendarItem`/`CalendarDay`, ajouter `CalendarPublication`) :

```ts
export type CalendarItem = {
  publicationId: string;
  postId: string;
  excerpt: string;
  thumbnailUrl: string | null;
  status: string;
};
export type CalendarDay = { date: Date; inMonth: boolean; items: CalendarItem[] };
export type CalendarPublication = Publication & { thumbnailUrl: string | null };
```

Remplacer la fonction `title` par `excerpt` :

```ts
// Deux premières lignes non vides du contenu (le rendu calendrier les borne en CSS).
function excerpt(snapshot: string): string {
  return snapshot
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 2)
    .join('\n');
}
```

Changer la signature et l'assemblage de `buildMonthGrid` :

```ts
export function buildMonthGrid(
  year: number,
  month: number,
  pubs: CalendarPublication[],
): CalendarDay[][] {
  const byDay = new Map<string, CalendarItem[]>();
  for (const p of pubs) {
    const d = calendarDate(p);
    if (!d) continue;
    const key = dayKey(d);
    const item: CalendarItem = {
      publicationId: p.id,
      postId: p.postId,
      excerpt: excerpt(p.contentSnapshot),
      thumbnailUrl: p.thumbnailUrl,
      status: p.status,
    };
    const arr = byDay.get(key);
    if (arr) arr.push(item);
    else byDay.set(key, [item]);
  }
```

Et plus bas, remplacer le tri par `excerpt` :

```ts
      const items = (byDay.get(dayKey(date)) ?? []).sort((a, b) =>
        a.excerpt.localeCompare(b.excerpt),
      );
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run --project=unit test/unit/month-grid.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendar/month-grid.ts test/unit/month-grid.test.ts
git commit -m "✨ calendrier : items enrichis (excerpt 2 lignes + miniature)"
```

---

## Task 3: Repo `listPublicationsForCalendar` (join miniature)

**Files:**
- Modify: `src/lib/db/repositories/publications.ts`
- Test: `test/integration/publications-repository.test.ts`

- [ ] **Step 1: Écrire le test d'intégration (échec attendu)**

Dans `test/integration/publications-repository.test.ts`, ajouter l'import puis un test. Compléter l'import existant depuis le repo avec `listPublicationsForCalendar`, et ajouter en fin de `describe` :

```ts
  test('listPublicationsForCalendar joint la miniature image du post', async () => {
    await makeUser('ucal', 'ucal@test.com');
    // Post avec image (le media doit exister avant : FK posts.media_id)
    const [m] = await db
      .insert(media)
      .values({
        id: 'mediacal1',
        userId: 'ucal',
        kind: 'image',
        assetKey: 'https://img/asset.png',
        previewKey: 'prev',
        width: 100,
        height: 100,
      })
      .returning();
    const withImg = await createPost('ucal', {
      title: 'Avec image',
      content: 'c',
      mediaId: m!.id,
    });
    await createPublication('ucal', {
      postId: withImg.id,
      contentSnapshot: 'snap',
      platform: 'linkedin',
    });
    // Post sans image
    const noImg = await createPost('ucal', { title: 'Sans image', content: 'c' });
    await createPublication('ucal', {
      postId: noImg.id,
      contentSnapshot: 'snap2',
      platform: 'linkedin',
    });

    const rows = await listPublicationsForCalendar('ucal');
    const byPost = new Map(rows.map((r) => [r.postId, r]));
    expect(byPost.get(withImg.id)?.thumbnailUrl).toBe('https://img/asset.png');
    expect(byPost.get(noImg.id)?.thumbnailUrl).toBeNull();
  });
```

Ajouter l'import manquant en tête du fichier de test : `media` depuis `@/lib/db/schema`. `createPost`, `createPublication`, `listPublicationsForCalendar` et `db` font partie des imports à compléter (les deux premiers existent déjà).

- [ ] **Step 2: Lancer → échec attendu**

Run: `npx vitest run --project=integration test/integration/publications-repository.test.ts`
Expected: FAIL (`listPublicationsForCalendar` introuvable). *(Nécessite Postgres de test ; si indisponible localement, ce test tourne en CI — voir Task 9.)*

- [ ] **Step 3: Implémenter la fonction**

Dans `src/lib/db/repositories/publications.ts`, ajouter en tête l'import du type et des tables, puis la fonction.

Imports (compléter l'existant) :

```ts
import { and, desc, eq } from 'drizzle-orm';
import type { CalendarPublication } from '@/lib/calendar/month-grid';
import { db } from '../client';
import { createId } from '../id';
import { media, posts, type Publication, publications } from '../schema';
```

Fonction (après `listPublications`) :

```ts
// Publications de l'utilisateur enrichies de la miniature image du post lié (URL publique
// assetKey si le post a une image, null sinon). Utilisé par la vue calendrier.
export async function listPublicationsForCalendar(
  userId: string,
): Promise<CalendarPublication[]> {
  const rows = await db
    .select({ publication: publications, assetKey: media.assetKey, kind: media.kind })
    .from(publications)
    .leftJoin(posts, eq(publications.postId, posts.id))
    .leftJoin(media, eq(posts.mediaId, media.id))
    .where(eq(publications.userId, userId));
  return rows.map((r) => ({
    ...r.publication,
    thumbnailUrl: r.kind === 'image' ? r.assetKey : null,
  }));
}
```

- [ ] **Step 4: Lancer → succès**

Run: `npx vitest run --project=integration test/integration/publications-repository.test.ts`
Expected: PASS (test DB requis).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/publications.ts test/integration/publications-repository.test.ts
git commit -m "✨ repo : listPublicationsForCalendar (join miniature image)"
```

---

## Task 4: Composant présentationnel `LinkedInPostPreview` + `PostText`

**Files:**
- Create: `src/components/linkedin/post-text.tsx`
- Create: `src/components/linkedin/post-preview.tsx`

*(Composants UI sans I/O : pas de test unitaire — pas de harnais de test composant dans le repo. Vérifiés par le typecheck/lint ici et l'e2e en Task 8.)*

- [ ] **Step 1: Créer `post-text.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';

// Reproduit le « voir plus » du fil LinkedIn : tronqué à 3 lignes, bouton affiché
// seulement si le texte déborde, dépliage en place sans repli.
export function PostText({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [content]);

  return (
    <div className="text-neutral-900 text-sm leading-snug">
      <p ref={ref} className={`whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
        {content}
      </p>
      {overflowing && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 font-medium text-neutral-500 hover:text-neutral-700"
        >
          …voir plus
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Créer `post-preview.tsx`**

```tsx
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { PostText } from './post-text';

export type LinkedInStats = { reactions: number; comments: number; reposts: number };

const DEFAULT_STATS: LinkedInStats = { reactions: 128, comments: 14, reposts: 3 };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function LinkedInPostPreview({
  author,
  content,
  image,
  stats = DEFAULT_STATS,
}: {
  author: LinkedInAuthor;
  content: string;
  image?: { url: string } | null;
  stats?: LinkedInStats;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-start gap-2 p-3">
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            className="h-12 w-12 flex-none rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#0a66c2] font-semibold text-sm text-white">
            {initials(author.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-neutral-900 text-sm">{author.name}</div>
          {author.headline ? (
            <div className="truncate text-neutral-500 text-xs">{author.headline}</div>
          ) : null}
          <div className="text-neutral-500 text-xs">Maintenant · 🌐</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <PostText content={content} />
      </div>
      {image ? <img src={image.url} alt="" className="w-full" /> : null}
      <div className="flex justify-between border-t px-3 py-2 text-neutral-500 text-xs">
        <span>👍❤️👏 {stats.reactions}</span>
        <span>
          {stats.comments} commentaires · {stats.reposts} republications
        </span>
      </div>
      <div className="flex justify-around border-t py-1 font-semibold text-neutral-600 text-sm">
        <span className="px-2 py-1.5">👍 J'aime</span>
        <span className="px-2 py-1.5">💬 Commenter</span>
        <span className="px-2 py-1.5">↪️ Partager</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur sur les deux nouveaux fichiers.

- [ ] **Step 4: Commit**

```bash
git add src/components/linkedin/
git commit -m "✨ composant LinkedInPostPreview (skin fil + voir plus)"
```

---

## Task 5: Calendrier élargi (page + rendu)

**Files:**
- Modify: `src/app/(app)/calendar/page.tsx`
- Modify: `src/app/(app)/calendar/_components/month-calendar.tsx`

- [ ] **Step 1: Brancher la page sur la requête jointe**

Dans `src/app/(app)/calendar/page.tsx`, remplacer l'import et l'appel `listPublications` :

```ts
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
```

- [ ] **Step 2: Agrandir les cases + nouvelle vignette**

Dans `src/app/(app)/calendar/_components/month-calendar.tsx`, remplacer le bloc des cases (le `.map` sur `weeks.flat()`) par :

```tsx
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
```

*(Le reste du fichier — en-tête mois, nav, légende — est inchangé.)*

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/calendar/page.tsx" "src/app/(app)/calendar/_components/month-calendar.tsx"
git commit -m "✨ calendrier : cases agrandies, vignette miniature + 2 lignes, lien modale"
```

---

## Task 6: Modale via route interceptée

**Files:**
- Create: `src/app/(app)/calendar/layout.tsx`
- Create: `src/app/(app)/calendar/@modal/default.tsx`
- Create: `src/app/(app)/calendar/@modal/(.)preview/[postId]/page.tsx`
- Create: `src/app/(app)/calendar/preview/[postId]/page.tsx`
- Create: `src/app/(app)/calendar/_components/post-preview-pane.tsx`
- Create: `src/app/(app)/calendar/_components/preview-dialog.tsx`

- [ ] **Step 1: `layout.tsx` (slot parallèle)**

```tsx
import type { ReactNode } from 'react';

export default function CalendarLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

- [ ] **Step 2: `@modal/default.tsx`**

```tsx
export default function Default() {
  return null;
}
```

- [ ] **Step 3: `_components/post-preview-pane.tsx` (serveur)**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost } from '@/lib/db/repositories/posts';
import { getAuthorIdentity } from '@/lib/linkedin/identity';

export async function PostPreviewPane({ postId }: { postId: string }) {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) notFound();
  const [author, media] = await Promise.all([
    getAuthorIdentity(userId),
    post.mediaId ? getMedia(userId, post.mediaId) : Promise.resolve(undefined),
  ]);
  const image = media && media.kind === 'image' ? { url: media.assetKey } : null;
  return (
    <div className="space-y-3">
      <LinkedInPostPreview author={author} content={post.content} image={image} />
      <Link
        href={`/posts/${post.id}`}
        className={buttonVariants({ variant: 'default', size: 'sm' })}
      >
        Modifier
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: `_components/preview-dialog.tsx` (client)**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

export function PreviewDialog({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">Aperçu du post</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: `@modal/(.)preview/[postId]/page.tsx` (interceptée)**

```tsx
import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';
import { PreviewDialog } from '@/app/(app)/calendar/_components/preview-dialog';

export default async function InterceptedPreview({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <PreviewDialog>
      <PostPreviewPane postId={postId} />
    </PreviewDialog>
  );
}
```

- [ ] **Step 6: `preview/[postId]/page.tsx` (pleine page)**

```tsx
import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <div className="mx-auto max-w-xl py-6">
      <PostPreviewPane postId={postId} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/calendar/layout.tsx" "src/app/(app)/calendar/@modal" "src/app/(app)/calendar/preview" "src/app/(app)/calendar/_components/post-preview-pane.tsx" "src/app/(app)/calendar/_components/preview-dialog.tsx"
git commit -m "✨ calendrier : modale d'aperçu via route interceptée"
```

---

## Task 7: Aperçu live dans l'éditeur de post

**Files:**
- Modify: `src/app/(app)/posts/[id]/page.tsx`
- Modify: `src/app/(app)/posts/[id]/_components/post-editor.tsx`

- [ ] **Step 1: Calculer et passer l'identité depuis la page**

Dans `src/app/(app)/posts/[id]/page.tsx`, ajouter l'import puis inclure `getAuthorIdentity` dans le `Promise.all` et passer `author` à `PostEditor`.

Ajouter l'import :

```ts
import { getAuthorIdentity } from '@/lib/linkedin/identity';
```

Remplacer le `Promise.all` (ajout de `getAuthorIdentity(userId)`) :

```ts
  const [templates, styles, galleryImagesRaw, latestPub, brand, author] = await Promise.all([
    listVisualTemplates(userId),
    listVisualStyles(userId),
    listStandaloneImages(userId),
    getLatestPublicationForPost(userId, post.id),
    buildBrandContext(userId),
    getAuthorIdentity(userId),
  ]);
```

Passer `author` au composant (ajouter la prop à l'élément `<PostEditor … />`) :

```tsx
      <PostEditor
        post={post}
        templates={templates}
        templatePreviews={templatePreviews}
        styles={styles.map((s) => ({ id: s.id, name: s.name }))}
        galleryImages={galleryImages}
        mediaInfo={mediaInfo}
        author={author}
      />
```

- [ ] **Step 2: Panneau d'aperçu live dans l'éditeur**

Dans `src/app/(app)/posts/[id]/_components/post-editor.tsx` :

Ajouter les imports (le type `LinkedInAuthor` vient de `identity`, le composant de `post-preview`) :

```tsx
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
```

Ajouter `author` au type `Props` :

```tsx
type Props = {
  post: Post;
  templates: VisualTemplate[];
  templatePreviews: TemplatePreview[];
  styles: { id: string; name: string }[];
  galleryImages: GalleryImage[];
  mediaInfo: MediaInfo | null;
  author: LinkedInAuthor;
};
```

Déstructurer `author` dans la signature de `PostEditor` (ajouter `author,` à la liste).

Juste avant le `<footer …>`, insérer le panneau d'aperçu (alimenté par l'état live `content`) :

```tsx
      <section className="space-y-2">
        <h2 className="font-semibold text-muted-foreground text-sm">Aperçu LinkedIn</h2>
        <LinkedInPostPreview
          author={author}
          content={content}
          image={
            mediaInfo && mediaInfo.kind === 'image' ? { url: mediaInfo.url } : null
          }
        />
      </section>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/posts/[id]/page.tsx" "src/app/(app)/posts/[id]/_components/post-editor.tsx"
git commit -m "✨ éditeur : aperçu LinkedIn live à côté du contenu"
```

---

## Task 8: E2E — modale, voir plus, bouton Modifier

**Files:**
- Modify: `test/e2e/calendar.spec.ts`

- [ ] **Step 1: Mettre à jour le test calendrier**

Remplacer le corps du `test('planifier un post …')` (à partir de `const postId = …`) pour : créer un post, lui donner un contenu long, le planifier, ouvrir la modale, déplier « voir plus », puis cliquer Modifier.

Remplacer le `test(...)` par :

```ts
  test('planifier un post puis le prévisualiser en modale LinkedIn', async ({ page }) => {
    await signup(page, `pw-cal-${Date.now()}@test.invalid`);
    await connectLinkedIn(page);
    const postId = await createPost(page, 'Idée calendrier');

    // Contenu long (multi-lignes) pour déclencher le « voir plus ».
    const longContent = Array.from({ length: 12 }, (_, i) => `Ligne ${i + 1} du post de test`).join(
      '\n',
    );
    const textarea = page.locator('textarea.font-mono');
    await textarea.fill(longContent);
    await textarea.blur();

    // Planifie le 15 du mois prochain à 10:00 (mi-journée → robuste aux fuseaux).
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 15, 10, 0);
    const local = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-15T10:00`;
    const monthParam = `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;

    await page.fill('input[type="datetime-local"]', local);
    await page.getByRole('button', { name: 'Planifier' }).click();
    await expect(page.getByText(/Planifié pour le/)).toBeVisible({ timeout: 10_000 });

    // Le calendrier affiche une vignette liant vers la modale d'aperçu.
    await page.goto(`/calendar?month=${monthParam}`);
    const chip = page.locator(`a[href="/calendar/preview/${postId}"]`);
    await expect(chip.first()).toBeVisible({ timeout: 10_000 });
    await chip.first().click();

    // La modale s'ouvre (URL interceptée) et montre le skin LinkedIn.
    await expect(page).toHaveURL(new RegExp(`/calendar/preview/${postId}`));
    await expect(page.getByText('Ligne 1 du post de test')).toBeVisible({ timeout: 10_000 });

    // « voir plus » déplie le texte.
    const seeMore = page.getByRole('button', { name: /voir plus/ });
    await expect(seeMore).toBeVisible();
    await seeMore.click();
    await expect(page.getByText('Ligne 12 du post de test')).toBeVisible();

    // Bouton Modifier → page d'édition du post.
    await page.getByRole('link', { name: 'Modifier' }).click();
    await expect(page).toHaveURL(new RegExp(`/posts/${postId}`));
  });
```

- [ ] **Step 2: Lancer l'e2e calendrier**

Run: `npm run test:e2e -- calendar`
Expected: PASS. *(Nécessite l'app + Postgres de test ; tourne en CI si indisponible localement — voir Task 9.)*

- [ ] **Step 3: Commit**

```bash
git add test/e2e/calendar.spec.ts
git commit -m "✅ e2e : modale d'aperçu LinkedIn (voir plus + Modifier)"
```

---

## Task 9: Vérification finale + lint + build

**Files:** aucun (vérification).

- [ ] **Step 1: Lint global**

Run: `npm run lint`
Expected: « Checked … No errors ».

- [ ] **Step 2: Tests unitaires**

Run: `npm run test:unit`
Expected: PASS (dont `linkedin-identity` et `month-grid`).

- [ ] **Step 3: Build de production (typecheck + compilation)**

Run: `npm run build`
Expected: build réussi (les routes `calendar`, `calendar/preview/[postId]` apparaissent).

- [ ] **Step 4: Pousser la branche (déclenche la preview)**

```bash
git push -u origin work/contentos-calendar-preview
```

Puis ouvrir la PR (voir handoff `finishing-a-development-branch`). Les tests d'intégration + e2e tournent dans la CI GitHub ; suivre avec `gh run watch`. Preview attendue : `https://contentos-work-contentos-calendar-preview.lab.avqn.ch`.

---

## Notes de vérification croisée (spec → plan)

- Calendrier agrandi + miniature + 2 lignes → Tasks 2, 3, 5. ✓
- `LinkedInPostPreview` réutilisable + « voir plus » fidèle → Task 4. ✓
- Identité réelle (compte LinkedIn + marque, replis) → Task 1. ✓
- Modale via route interceptée + pleine page de repli + bouton Modifier → Task 6. ✓
- Aperçu live dans l'éditeur → Task 7. ✓
- Cas limites (pas d'image, pas de compte/marque, post introuvable, texte court) → Tasks 1, 4, 5, 6. ✓
- Tests unit/integration/e2e → Tasks 1, 2, 3, 8, 9. ✓
