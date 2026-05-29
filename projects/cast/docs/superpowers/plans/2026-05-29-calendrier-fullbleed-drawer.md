# Refonte calendrier Cast — full-bleed + drawer — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Le calendrier remplit la zone de contenu (full-bleed cadré à droite de la sidebar, pleine hauteur), le titre est remplacé par une barre fine (mois + ‹ › + « Aujourd'hui »), et le clic sur un post ouvre un drawer overlay à droite avec aperçu scrollable + pied fixe (Modifier + lien LinkedIn si publié).

**Architecture:** Panneau `fixed` ancré sur la zone de contenu (local à cast, pas de modif de l'AppShell partagé). Grille en `flex h-full flex-col` + grid-rows `minmax(120px,1fr)` scrollable. Drawer = parallel route `@modal` existante, `PreviewSidebar` devient overlay sur toutes tailles, `PostPreviewPane` se réorganise scroll+pied fixe. Le lien LinkedIn vient d'une nouvelle fonction repo testée (TDD).

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, Drizzle ORM, Vitest (node, pas de tests de rendu → UI vérifiée par `tsc`/`biome`/preview).

**Réf spec :** `projects/cast/docs/superpowers/specs/2026-05-29-calendrier-fullbleed-drawer-design.md`

---

## Fichiers

- Modifier `projects/cast/src/lib/db/repositories/publications.ts` — + `getPublishedExternalUrlForPost`
- Test `projects/cast/test/integration/publications-repository.test.ts` — + 3 cas
- Modifier `projects/cast/src/app/(app)/calendar/_components/month-calendar.tsx` — barre + grille pleine hauteur
- Modifier `projects/cast/src/app/(app)/calendar/layout.tsx` — panneau fixed
- Modifier `projects/cast/src/app/(app)/calendar/_components/preview-sidebar.tsx` — drawer overlay
- Modifier `projects/cast/src/app/(app)/calendar/_components/post-preview-pane.tsx` — scroll + pied fixe
- Modifier `projects/cast/src/app/(app)/calendar/preview/[postId]/page.tsx` — contexte hauteur

---

## Task 1 : fonction repo `getPublishedExternalUrlForPost` (TDD)

**Files:** Modifier `src/lib/db/repositories/publications.ts` ; Test `test/integration/publications-repository.test.ts`

- [ ] **Step 1 — test qui échoue.** Ajouter à la fin du `describe('publications repository', …)` :

```ts
test('getPublishedExternalUrlForPost : null si aucune publication', async () => {
  const postId = await makePostForUser('uX');
  expect(await getPublishedExternalUrlForPost('uX', postId)).toBeNull();
});

test('getPublishedExternalUrlForPost : null si planifié non publié', async () => {
  const postId = await makePostForUser('uX');
  await createPublication('uX', { postId, contentSnapshot: 's', platform: 'linkedin' });
  expect(await getPublishedExternalUrlForPost('uX', postId)).toBeNull();
});

test('getPublishedExternalUrlForPost : URL de la dernière publication publiée', async () => {
  const postId = await makePostForUser('uX');
  const older = await createPublication('uX', { postId, contentSnapshot: 's', platform: 'linkedin' });
  await updatePublication('uX', older.id, {
    status: 'published', publishedAt: new Date('2026-01-01'), externalUrl: 'https://li/old',
  });
  const newer = await createPublication('uX', { postId, contentSnapshot: 's', platform: 'linkedin' });
  await updatePublication('uX', newer.id, {
    status: 'published', publishedAt: new Date('2026-02-01'), externalUrl: 'https://li/new',
  });
  expect(await getPublishedExternalUrlForPost('uX', postId)).toBe('https://li/new');
});
```

Ajouter `getPublishedExternalUrlForPost` à l'import depuis `@/lib/db/repositories/publications`.

- [ ] **Step 2 — vérifier l'échec.** `npm run test:integration` → FAIL (`getPublishedExternalUrlForPost is not a function`).

- [ ] **Step 3 — implémenter.** Dans `publications.ts`, ajouter `isNotNull` à l'import drizzle (`import { and, desc, eq, isNotNull } from 'drizzle-orm';`) et la fonction :

```ts
// URL publique du post sur la plateforme (LinkedIn) pour la dernière publication
// effectivement publiée de ce post. null si rien n'a été publié.
export async function getPublishedExternalUrlForPost(
  userId: string,
  postId: string,
): Promise<string | null> {
  const rows = await db
    .select({ externalUrl: publications.externalUrl })
    .from(publications)
    .where(
      and(
        eq(publications.userId, userId),
        eq(publications.postId, postId),
        eq(publications.status, 'published'),
        isNotNull(publications.externalUrl),
      ),
    )
    .orderBy(desc(publications.publishedAt))
    .limit(1);
  return rows[0]?.externalUrl ?? null;
}
```

- [ ] **Step 4 — vérifier le succès.** `npm run test:integration` → PASS.

- [ ] **Step 5 — commit.** `git add -A && git commit -m "feat(cast): repo getPublishedExternalUrlForPost (lien post publié)"`

---

## Task 2 : barre fine + grille pleine hauteur — `month-calendar.tsx`

**Files:** Modifier `src/app/(app)/calendar/_components/month-calendar.tsx`

- [ ] **Step 1 — réécrire le composant.** Remplacer tout le `return (…)` par cette structure (retire le `<h1>` titre et la légende du bas ; barre fine en haut ; grille `flex-1` scrollable, lignes `minmax(120px,1fr)`) :

```tsx
return (
  <div className="flex h-full flex-col">
    <div className="flex flex-none items-center justify-between gap-2 border-b px-3 py-2">
      <span className="font-medium text-sm capitalize">{label}</span>
      <div className="flex items-center gap-1.5 text-sm">
        <Link
          href={`/calendar?month=${monthParam(p.year, p.month)}`}
          className="rounded-md border px-2.5 py-1 hover:bg-neutral-100"
          aria-label="Mois précédent"
        >
          ‹
        </Link>
        <Link
          href={`/calendar?month=${monthParam(n.year, n.month)}`}
          className="rounded-md border px-2.5 py-1 hover:bg-neutral-100"
          aria-label="Mois suivant"
        >
          ›
        </Link>
        <Link
          href="/calendar"
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
                href={`/calendar/preview/${it.postId}`}
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
```

- [ ] **Step 2 — typecheck + lint.** `npx tsc --noEmit && npm run lint` → OK.

- [ ] **Step 3 — commit.** `git add -A && git commit -m "feat(cast): calendrier barre fine + grille pleine hauteur"`

---

## Task 3 : panneau fixed — `layout.tsx`

**Files:** Modifier `src/app/(app)/calendar/layout.tsx`

- [ ] **Step 1 — remplacer le breakout par un panneau fixed** ancré à droite de la sidebar (desktop `left-60`/`top-0`, mobile `left-0`/`top-14`) :

```tsx
import type { ReactNode } from 'react';
import { PreviewSidebar } from './_components/preview-sidebar';

export default function CalendarLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-10 lg:top-0 lg:left-60">
      {children}
      <PreviewSidebar>{modal}</PreviewSidebar>
    </div>
  );
}
```

- [ ] **Step 2 — typecheck + lint.** `npx tsc --noEmit && npm run lint` → OK.

- [ ] **Step 3 — commit.** `git add -A && git commit -m "feat(cast): calendrier en panneau fixed cadré sur la zone de contenu"`

---

## Task 4 : drawer overlay — `preview-sidebar.tsx`

**Files:** Modifier `src/app/(app)/calendar/_components/preview-sidebar.tsx`

- [ ] **Step 1 — réécrire en overlay sur toutes tailles** (scrim partout, plus d'en-tête « Aperçu du post », bouton fermer flottant, enfant pleine hauteur) :

```tsx
'use client';

import { XIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

export function PreviewSidebar({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const open = pathname?.startsWith('/calendar/preview/') ?? false;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') router.back();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, router]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fermer l'aperçu"
        onClick={() => router.back()}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <aside
        aria-label="Aperçu du post"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-in flex-col border-l bg-white shadow-xl duration-200 slide-in-from-right"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 rounded-md bg-white/80 p-1.5 text-muted-foreground backdrop-blur hover:bg-neutral-100 hover:text-foreground"
        >
          <XIcon className="h-4 w-4" />
        </button>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2 — typecheck + lint.** `npx tsc --noEmit && npm run lint` → OK.

- [ ] **Step 3 — commit.** `git add -A && git commit -m "feat(cast): aperçu post en drawer overlay (toutes tailles)"`

---

## Task 5 : aperçu scroll + pied fixe — `post-preview-pane.tsx` + page fallback

**Files:** Modifier `src/app/(app)/calendar/_components/post-preview-pane.tsx` ; `src/app/(app)/calendar/preview/[postId]/page.tsx`

- [ ] **Step 1 — réécrire `post-preview-pane.tsx`** (flex colonne pleine hauteur : aperçu scrollable, pied fixe Modifier + lien LinkedIn si publié) :

```tsx
import { ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkedInPostPreview } from '@/components/linkedin/post-preview';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getPost } from '@/lib/db/repositories/posts';
import { getPublishedExternalUrlForPost } from '@/lib/db/repositories/publications';
import { getAuthorIdentity } from '@/lib/linkedin/identity';

export async function PostPreviewPane({ postId }: { postId: string }) {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) notFound();
  const author = await getAuthorIdentity(userId);
  const image = post.mediaKind === 'image' && post.mediaUrl ? { url: post.mediaUrl } : null;
  const publishedUrl = await getPublishedExternalUrlForPost(userId, postId);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-12">
        <LinkedInPostPreview author={author} content={post.content} image={image} />
      </div>
      <div className="flex flex-none flex-col gap-2 border-t p-4">
        <Link
          href={`/posts/${post.id}`}
          className={buttonVariants({ variant: 'default', size: 'default' })}
        >
          Modifier
        </Link>
        {publishedUrl ? (
          <a
            href={publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Voir le post sur LinkedIn
          </a>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 — donner un contexte de hauteur à la page fallback** `preview/[postId]/page.tsx` (sinon `h-full` = 0 hors drawer) :

```tsx
import { PostPreviewPane } from '@/app/(app)/calendar/_components/post-preview-pane';

export default async function PreviewPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return (
    <div className="mx-auto flex h-[100dvh] max-w-xl flex-col">
      <PostPreviewPane postId={postId} />
    </div>
  );
}
```

- [ ] **Step 3 — typecheck + lint.** `npx tsc --noEmit && npm run lint` → OK.

- [ ] **Step 4 — commit.** `git add -A && git commit -m "feat(cast): aperçu plein panneau scrollable + pied fixe (Modifier, lien LinkedIn)"`

---

## Task 6 : vérification globale + push + PR

- [ ] **Step 1 — suite complète.** `npm test` → tous verts (month-grid + publications intégration inclus).
- [ ] **Step 2 — build.** `npm run build` → succès (typecheck Next + compilation).
- [ ] **Step 3 — push.** `git push -u origin claude/admiring-euler-f6zRh` (retries backoff si réseau).
- [ ] **Step 4 — PR** vers `main` (titre + corps FR récapitulant la refonte + lien preview attendu).

## Self-review (couverture spec)

- Full-bleed cadré (§1) → Task 3. Pleine hauteur + min-height + scroll (§2) → Task 2. Barre fine mois/‹›/Aujourd'hui, sans légende (§3) → Task 2. Drawer overlay + scrim partout, sans en-tête (§4) → Task 4. Scroll + pied fixe Modifier + lien LinkedIn (§4) → Task 5 + Task 1. Page fallback (§4) → Task 5. Données sans migration, dernière publiée (§Données) → Task 1.
