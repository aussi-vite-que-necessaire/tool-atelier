# Espace « Compte » niveau suite — connexions sociales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir la connexion LinkedIn (déjà fonctionnelle) dans un espace `/account` niveau suite, accessible depuis le menu utilisateur, extensible pour d'autres réseaux et un futur onglet profil.

**Architecture:** Nouvelle section `src/app/(app)/account/` avec sous-nav (Connexions). La page LinkedIn est déplacée depuis `cast/settings/connections`. Le chemin canonique `/account/connections` est centralisé dans un module pur (`src/lib/account/routes.ts`) et réutilisé par le callback OAuth, l'action de déconnexion et le panneau de publication. L'ancien chemin redirige vers le nouveau.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind, Base UI (`@base-ui/react`), Vitest. Tout dans `projects/app/`.

---

### Task 1: Chemin canonique des connexions (module pur + test)

**Files:**
- Create: `projects/app/src/lib/account/routes.ts`
- Test: `projects/app/test/unit/account-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// projects/app/test/unit/account-routes.test.ts
import { describe, expect, it } from 'vitest';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';

describe('account routes', () => {
  it('expose le chemin canonique des connexions niveau suite', () => {
    expect(ACCOUNT_CONNECTIONS_PATH).toBe('/account/connections');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `projects/app`): `npm test -- account-routes`
Expected: FAIL — module `@/lib/account/routes` introuvable.

- [ ] **Step 3: Write minimal implementation**

```ts
// projects/app/src/lib/account/routes.ts
// Chemin canonique de la page de connexions sociales (espace Compte, niveau
// suite). Centralisé pour que le callback OAuth, l'action de déconnexion et les
// liens d'UI pointent tous au même endroit.
export const ACCOUNT_CONNECTIONS_PATH = '/account/connections';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- account-routes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/lib/account/routes.ts projects/app/test/unit/account-routes.test.ts
git commit -m "feat(account): chemin canonique des connexions"
```

---

### Task 2: Section `/account` — layout, sous-nav, index

**Files:**
- Create: `projects/app/src/app/(app)/account/layout.tsx`
- Create: `projects/app/src/app/(app)/account/account-nav.tsx`
- Create: `projects/app/src/app/(app)/account/page.tsx`

Pas de test unitaire dédié (server components / redirect — non testés dans ce codebase qui teste la logique pure). Vérification au build + `/apercu`.

- [ ] **Step 1: Créer la sous-nav (calquée sur `cast-nav.tsx`)**

```tsx
// projects/app/src/app/(app)/account/account-nav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sous-navigation locale de l'espace Compte. Un onglet aujourd'hui (Connexions) ;
// d'autres viendront (Profil, …). Règle d'activité par startsWith.
const ACCOUNT_LINKS = [{ href: '/account/connections', label: 'Connexions' }];

export function AccountNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav
      aria-label="Navigation compte"
      className="sticky top-14 z-20 flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6"
    >
      {ACCOUNT_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {link.label}
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-signal"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Créer le layout de section**

```tsx
// projects/app/src/app/(app)/account/layout.tsx
import { AccountNav } from './account-nav';

// Section Compte : sous-nav locale + contenu, dans une largeur cohérente avec le
// reste de la suite. La garde d'auth vit dans le layout (app) parent.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccountNav />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">{children}</div>
    </>
  );
}
```

- [ ] **Step 3: Créer l'index (redirect)**

```tsx
// projects/app/src/app/(app)/account/page.tsx
import { redirect } from 'next/navigation';

export default function AccountIndexPage() {
  redirect('/account/connections');
}
```

- [ ] **Step 4: Vérifier la compilation des types**

Run (from `projects/app`): `npx tsc --noEmit`
Expected: pas d'erreur liée à ces fichiers (les imports utilisés existent : `cn` dans `@/lib/utils`).

- [ ] **Step 5: Commit**

```bash
git add "projects/app/src/app/(app)/account/"
git commit -m "feat(account): section Compte (layout, sous-nav, index)"
```

---

### Task 3: Déplacer la page Connexions sous `/account`

**Files:**
- Create: `projects/app/src/app/(app)/account/connections/page.tsx`
- Create: `projects/app/src/app/(app)/account/connections/actions.ts`
- Create: `projects/app/src/app/(app)/account/connections/_components/disconnect-button.tsx`

Le contenu reprend l'existant de `cast/settings/connections`, avec deux ajustements : l'action `revalidatePath` cible le nouveau chemin (via la constante), et la page n'est plus enveloppée par `SettingsPage` (qui affiche l'eyebrow « Réglages » propre à cast) — on garde un en-tête local cohérent avec l'espace Compte.

- [ ] **Step 1: Créer `actions.ts`** (déconnexion, revalide le nouveau chemin)

```ts
// projects/app/src/app/(app)/account/connections/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';
import { requireUserId } from '@/lib/auth/session';
import { deleteSocialAccount } from '@/lib/db/repositories/social-accounts';

export async function disconnectLinkedInAction(): Promise<void> {
  const userId = await requireUserId();
  await deleteSocialAccount(userId, 'linkedin');
  revalidatePath(ACCOUNT_CONNECTIONS_PATH);
}
```

- [ ] **Step 2: Créer `_components/disconnect-button.tsx`** (identique à l'existant, import relatif vers `../actions`)

```tsx
// projects/app/src/app/(app)/account/connections/_components/disconnect-button.tsx
'use client';

import { Button } from '@/components/ui/button';
import { disconnectLinkedInAction } from '../actions';

export function DisconnectButton() {
  return (
    <form action={disconnectLinkedInAction}>
      <Button type="submit" variant="ghost" size="sm">
        Déconnecter
      </Button>
    </form>
  );
}
```

> Note d'exécution : si l'original `cast/settings/connections/_components/disconnect-button.tsx` diffère (props/variant), reprendre fidèlement son contenu en ne changeant que le chemin d'import de l'action. Lire l'original avant d'écrire.

- [ ] **Step 3: Créer `page.tsx`** (reprend l'UI existante, en-tête local au lieu de `SettingsPage`)

```tsx
// projects/app/src/app/(app)/account/connections/page.tsx
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { runwayDays } from '@/lib/linkedin/runway';
import { DisconnectButton } from './_components/disconnect-button';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const account = await getSocialAccount(userId, 'linkedin');
  const days = account ? runwayDays(account.expiresAt) : 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Compte</p>
        <h2 className="text-2xl font-semibold text-neutral-900">Connexions</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Comptes sociaux utilisés pour la publication.
        </p>
      </header>

      {sp.error && (
        <p className="text-sm text-red-600">
          {sp.error === 'state'
            ? 'Échec de la vérification (state). Réessaie.'
            : 'La connexion LinkedIn a échoué. Réessaie.'}
        </p>
      )}
      {sp.connected && <p className="text-sm text-green-700">Compte LinkedIn connecté.</p>}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">LinkedIn</p>
            {account ? (
              <p className="text-xs text-neutral-500">
                {account.displayName} ·{' '}
                <span className={days <= 7 ? 'text-red-600' : ''}>
                  expire dans {days} jour{days > 1 ? 's' : ''}
                </span>
              </p>
            ) : (
              <p className="text-xs text-neutral-500">Non connecté</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/linkedin/connect"
              className={buttonVariants({ variant: account ? 'outline' : 'default', size: 'sm' })}
            >
              {account ? 'Reconnecter' : 'Connecter LinkedIn'}
            </a>
            {account && <DisconnectButton />}
          </div>
        </div>
      </Card>
    </div>
  );
}
```

> Note d'exécution : lire l'original `cast/settings/connections/page.tsx` avant d'écrire pour reprendre exactement les imports/props réels (ce bloc est fidèle à l'original au moment du plan).

- [ ] **Step 4: Vérifier la compilation**

Run (from `projects/app`): `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 5: Commit**

```bash
git add "projects/app/src/app/(app)/account/connections/"
git commit -m "feat(account): page Connexions sous /account"
```

---

### Task 4: Rediriger l'ancien chemin + recâbler callback et publish-panel

**Files:**
- Modify: `projects/app/src/app/(app)/cast/settings/connections/page.tsx` (devient une redirection)
- Delete: `projects/app/src/app/(app)/cast/settings/connections/actions.ts`
- Delete: `projects/app/src/app/(app)/cast/settings/connections/_components/disconnect-button.tsx`
- Modify: `projects/app/src/app/api/linkedin/callback/route.ts:18`
- Modify: `projects/app/src/app/(app)/cast/posts/[id]/_components/publish-panel.tsx:98`

- [ ] **Step 1: Transformer l'ancienne page en redirection**

```tsx
// projects/app/src/app/(app)/cast/settings/connections/page.tsx
import { redirect } from 'next/navigation';
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';

// Les connexions sociales ont migré vers l'espace Compte (niveau suite).
export default function LegacyConnectionsPage() {
  redirect(ACCOUNT_CONNECTIONS_PATH);
}
```

- [ ] **Step 2: Supprimer l'action et le composant désormais inutilisés sous cast**

```bash
git rm "projects/app/src/app/(app)/cast/settings/connections/actions.ts" \
       "projects/app/src/app/(app)/cast/settings/connections/_components/disconnect-button.tsx"
```

- [ ] **Step 3: Recâbler la cible de redirection du callback OAuth**

Dans `projects/app/src/app/api/linkedin/callback/route.ts`, ajouter l'import et remplacer le littéral :

```ts
import { ACCOUNT_CONNECTIONS_PATH } from '@/lib/account/routes';
```

```ts
// remplacer :
//   const settings = new URL('/cast/settings/connections', env.APP_URL);
const settings = new URL(ACCOUNT_CONNECTIONS_PATH, env.APP_URL);
```

- [ ] **Step 4: Recâbler le lien d'erreur du panneau de publication**

Dans `projects/app/src/app/(app)/cast/posts/[id]/_components/publish-panel.tsx`, remplacer le `href` du lien de reconnexion :

```tsx
// remplacer href="/cast/settings/connections" par :
<Link href="/account/connections" className="underline">
```

- [ ] **Step 5: Vérifier qu'aucune référence à l'ancien chemin ne subsiste (hors redirection)**

Run (from `projects/app`): `grep -rn "cast/settings/connections" src`
Expected: aucune occurrence (l'ancienne page redirige via la constante, plus de littéral).

- [ ] **Step 6: Compiler + tests + commit**

Run: `npx tsc --noEmit && npm test`
Expected: build OK, suite verte.

```bash
git add -A
git commit -m "feat(account): rediriger l'ancien chemin et recâbler callback + publish-panel"
```

---

### Task 5: Point d'entrée — menu utilisateur + drawer mobile

**Files:**
- Modify: `projects/app/src/components/app-shell/suite-nav.tsx` (UserMenu : lien « Compte »)
- Modify: `projects/app/src/components/app-shell/mobile-drawer.tsx` (entrée « Compte » hors domaines)

- [ ] **Step 1: Ajouter le lien « Compte » dans `UserMenu`**

Dans `suite-nav.tsx`, importer `Link` (déjà importé) et insérer un `Menu.Item` « Compte » juste après le séparateur (`<div className="my-1 h-px bg-border" />`), avant le `Menu.Item` de déconnexion :

```tsx
<Menu.Item
  className="rounded-lg text-sm text-muted-foreground outline-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
  render={
    <Link href="/account/connections" className="flex w-full items-center gap-2 px-2.5 py-1.5">
      Compte
    </Link>
  }
/>
```

- [ ] **Step 2: Ajouter l'entrée « Compte » au drawer mobile**

Dans `mobile-drawer.tsx`, après la `<nav>` listant `SUITE_ENTRIES`, ajouter un lien séparé vers `/account/connections` (referme le tiroir au clic) :

```tsx
<div className="mt-4 border-t border-sidebar-border pt-4">
  <Link
    href="/account/connections"
    onClick={() => setOpen(false)}
    className="flex items-center rounded-xl px-3 py-2.5 font-medium transition-colors hover:bg-sidebar-accent/60"
  >
    Compte
  </Link>
</div>
```

> Note d'exécution : si `--sidebar-border` n'existe pas dans le thème, utiliser `border-border`. Vérifier en lisant les classes déjà employées dans le fichier.

- [ ] **Step 3: Compiler + commit**

Run (from `projects/app`): `npx tsc --noEmit`
Expected: pas d'erreur.

```bash
git add projects/app/src/components/app-shell/suite-nav.tsx projects/app/src/components/app-shell/mobile-drawer.tsx
git commit -m "feat(account): accès Compte depuis le menu utilisateur et le drawer mobile"
```

---

### Task 6: L'œil de l'agent + push + PR

- [ ] **Step 1: Lancer la suite de tests complète**

Run (from `projects/app`): `npm test`
Expected: verte.

- [ ] **Step 2: `/apercu`** sur `/account/connections` (mobile + desktop) et menu utilisateur ouvert. Lire les PNG, critiquer (hiérarchie, espacement, cohérence thème), corriger si besoin, re-screenshoter.

- [ ] **Step 3: Push de la branche**

```bash
git push -u origin claude/linkedin-account-connection-FGWQi
```

- [ ] **Step 4: Ouvrir la PR**, puis `subscribe_pr_activity` (CI + revue) et rester jusqu'au vert.
