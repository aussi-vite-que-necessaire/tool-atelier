# AppShell partagé + homogénéisation de la suite — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter cast, media et ressources d'un cadre applicatif identique (`AppShell` partagé : sidebar + lien Contentos preview-aware + cadrage de page), et migrer entièrement ressources sur les tokens/composants `@contentos/ui`.

**Architecture:** Un organisme présentationnel `AppShell` (client) ajouté à `@contentos/ui`, vendoré dans chaque projet par `bin/ui-sync`. Chaque layout serveur garde sa garde d'auth puis rend `<AppShell>` avec une nav déclarative texte. `bin/ui-sync` gagne le support de l'arbo racine (ressources). Le lien « Contentos » est calculé serveur via un helper pur `centralUrl(APP_ENV)`.

**Tech Stack:** Next 16 (App Router), React Server/Client Components, Tailwind v4 + tokens OKLch `@contentos/ui`, base-ui, lucide, next-themes, vitest (cast/ressources), bash (ui-sync).

**Spec :** `docs/superpowers/specs/2026-05-29-appshell-suite-design.md`

---

## Structure de fichiers

**`packages/ui` (source canonique) :**
- Create `packages/ui/src/lib/central-url.ts` — helper pur, URL du site central (preview-aware).
- Create `packages/ui/src/components/app-shell.tsx` — organisme shell (sidebar + main + brand).

**`bin/ui-sync` :**
- Modify — ajouter les 2 fichiers aux mappings ; support arbo racine (strip `src/` si `projects/<p>/src` absent).

**Projets (fichiers vendorés, NE PAS éditer à la main) :**
- `src/lib/central-url.ts`, `src/components/ui/app-shell.tsx` (media, cast) ; versions racine pour ressources.

**media :**
- Modify `projects/media/src/app/(admin)/layout.tsx` ; Delete `projects/media/src/app/(admin)/admin-nav.tsx`.
- Modify `projects/media/src/app/layout.tsx` (alignement body class).

**cast :**
- Modify `projects/cast/src/app/layout.tsx` (+ providers), Create `projects/cast/src/app/providers.tsx`.
- Modify `projects/cast/src/app/(app)/layout.tsx` et `projects/cast/src/app/(settings)/layout.tsx`.
- Delete `projects/cast/src/components/layout/app-header.tsx`, `projects/cast/src/components/settings/settings-sidebar.tsx`.

**ressources :**
- Modify `projects/ressources/package.json` (− geist, + next-themes).
- Modify `projects/ressources/app/layout.tsx`, Create `projects/ressources/app/providers.tsx`.
- Modify `projects/ressources/app/globals.css`, Create `projects/ressources/styles/ui-tokens.css`.
- Delete `projects/ressources/components/brand/logo.tsx`.
- Modify `projects/ressources/app/admin/layout.tsx`.
- Modify (migration de classes) : `app/admin/page.tsx`, `app/admin/audience/page.tsx`, `app/admin/r/[slug]/page.tsx`, `app/admin/r/[slug]/p/[[...path]]/page.tsx`, `components/admin/module-form.tsx`, `components/admin/page-tree-editor.tsx`.
- Vendorés (par ui-sync) : `components/ui/{button,badge,card,sidebar,sonner,...}.tsx`, `lib/utils.ts`, `lib/central-url.ts`, `components/ui/app-shell.tsx`.

---

## Phase 1 — `@contentos/ui` : helper, AppShell, ui-sync

### Task 1 : `bin/ui-sync` — support arbo racine + nouveaux mappings

**Files:**
- Modify: `bin/ui-sync` (bloc `mappings()` ~ lignes 21-36 ; `cmd_sync` ~ lignes 72-87 ; `cmd_check` ~ lignes 89-110)

- [ ] **Step 1 : Ajouter les 2 fichiers aux mappings**

Dans `mappings()`, ajouter ces deux lignes à la fin du heredoc (après `components/skeleton.tsx => ...`) :

```
lib/central-url.ts => src/lib/central-url.ts
components/app-shell.tsx => src/components/ui/app-shell.tsx
```

- [ ] **Step 2 : Ajouter la réécriture de chemin pour l'arbo racine**

Juste avant `resolve_proj()`, ajouter une fonction qui strippe `src/` si le projet n'a pas de dossier `src/` :

```bash
# Réécrit un chemin cible selon l'arbo du projet : les projets sans dossier
# `src/` (ex. ressources, docs) reçoivent les fichiers à la racine.
dst_path() {
  local dir="$1" rel="$2"
  if [ -d "$dir/src" ]; then
    printf '%s' "$rel"
  else
    printf '%s' "${rel#src/}"
  fi
}
```

- [ ] **Step 3 : Utiliser `dst_path` dans `cmd_sync`**

Dans `cmd_sync`, remplacer la ligne `local dst="$dir/$rel_dst"` par :

```bash
    local dst="$dir/$(dst_path "$dir" "$rel_dst")"
```

- [ ] **Step 4 : Utiliser `dst_path` dans `cmd_check`**

Dans `cmd_check`, remplacer la ligne `local dst="$dir/$rel_dst"` par :

```bash
    local dst="$dir/$(dst_path "$dir" "$rel_dst")"
```

Et remplacer les `$rel_dst` dans les messages (`✗ manquant: $rel_dst`, `✗ dérive: $rel_dst`) par une variable lisible — ajouter juste après le calcul de `dst` :

```bash
    local shown; shown="$(dst_path "$dir" "$rel_dst")"
```
puis utiliser `$shown` dans les deux `echo`.

- [ ] **Step 5 : Vérifier que `--list` montre les nouveaux fichiers**

Run: `bin/ui-sync --list`
Expected: la liste contient `lib/central-url.ts` et `components/app-shell.tsx`.

- [ ] **Step 6 : Commit**

```bash
git add bin/ui-sync
git commit -m "ui-sync : support arbo racine + mappings central-url/app-shell"
```

---

### Task 2 : Helper `centralUrl()` (TDD)

**Files:**
- Create: `packages/ui/src/lib/central-url.ts`
- Test: `projects/cast/src/lib/central-url.test.ts` (teste la copie vendorée)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `projects/cast/src/lib/central-url.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { centralUrl } from '@/lib/central-url';

describe('centralUrl', () => {
  it('pointe sur la prod quand APP_ENV vaut prod', () => {
    expect(centralUrl('prod')).toBe('https://contentos.ch');
  });

  it('pointe sur la prod quand APP_ENV est absent', () => {
    expect(centralUrl(undefined)).toBe('https://contentos.ch');
  });

  it('pointe sur le www de la branche en preview', () => {
    expect(centralUrl('wonderful-tesla-Gpzf6')).toBe(
      'https://www-wonderful-tesla-Gpzf6.preview.contentos.ch',
    );
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `cd projects/cast && npx vitest run src/lib/central-url.test.ts`
Expected: FAIL — `Cannot find module '@/lib/central-url'`.

- [ ] **Step 3 : Implémenter le helper dans la source canonique**

Créer `packages/ui/src/lib/central-url.ts` :

```ts
/**
 * URL du site central de la suite (contentos.ch), résolue depuis APP_ENV.
 *
 * `deploy.sh` injecte APP_ENV = 'prod' en prod, sinon le slug de branche (preview).
 * En preview on vise le www de la même branche (`www-<slug>.preview.contentos.ch`).
 * Ce www n'existe que s'il a été déployé sur la branche — sinon le lien est mort,
 * ce qui est acceptable en contexte de revue de preview.
 */
export function centralUrl(appEnv?: string): string {
  if (!appEnv || appEnv === 'prod') return 'https://contentos.ch';
  return `https://www-${appEnv}.preview.contentos.ch`;
}
```

- [ ] **Step 4 : Synchroniser dans cast**

Run: `bin/ui-sync cast`
Expected: ligne `✓ src/lib/central-url.ts`.

- [ ] **Step 5 : Lancer le test, vérifier le succès**

Run: `cd projects/cast && npx vitest run src/lib/central-url.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6 : Commit**

```bash
git add packages/ui/src/lib/central-url.ts projects/cast/src/lib/central-url.ts projects/cast/src/lib/central-url.test.ts
git commit -m "feat(ui): helper centralUrl preview-aware"
```

---

### Task 3 : Composant `AppShell`

**Files:**
- Create: `packages/ui/src/components/app-shell.tsx`

Pas de test unitaire (organisme présentationnel Next) — vérifié par les builds et la revue visuelle des phases suivantes.

- [ ] **Step 1 : Écrire le composant dans la source canonique**

Créer `packages/ui/src/components/app-shell.tsx` :

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@/components/ui/sidebar';

export type NavLink = { href: string; label: string };
export type NavSection = { label?: string; links: NavLink[] };

/**
 * AppShell — cadre applicatif partagé de la suite contentos.
 *
 * Sidebar (lien « Contentos » vers la suite + nom du projet, sections de nav,
 * footer libre) à gauche, contenu cadré à droite. Présentationnel : la garde
 * d'auth reste dans le layout serveur, qui passe `homeUrl` (cf. centralUrl) et
 * une nav déclarative en texte.
 */
export function AppShell({
  project,
  homeUrl,
  sections,
  footer,
  children,
}: {
  project: string;
  homeUrl: string;
  sections: NavSection[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarHeader>
          <a
            href={homeUrl}
            className="block text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Contentos
          </a>
          <span className="mt-1 block text-lg font-semibold text-sidebar-foreground">
            {project}
          </span>
        </SidebarHeader>
        {sections.map((section, i) => (
          <SidebarSection key={i} label={section.label}>
            {section.links.map((link) => (
              <SidebarItem
                key={link.href}
                active={pathname?.startsWith(link.href) ?? false}
                render={<Link href={link.href} />}
              >
                {link.label}
              </SidebarItem>
            ))}
          </SidebarSection>
        ))}
        {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
      </Sidebar>
      <main className="min-w-0 flex-1 overflow-x-clip">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2 : Synchroniser dans cast et media**

Run: `bin/ui-sync cast && bin/ui-sync media`
Expected: ligne `✓ src/components/ui/app-shell.tsx` pour les deux.

- [ ] **Step 3 : Vérifier que cast compile toujours (typecheck via build à venir)**

Run: `cd projects/cast && npx tsc --noEmit 2>&1 | head -20` *(si pas de script typecheck, ignorer les erreurs préexistantes ; aucune erreur ne doit concerner `app-shell.tsx` ou `central-url.ts`)*
Expected: aucune erreur mentionnant `app-shell.tsx`.

- [ ] **Step 4 : Commit**

```bash
git add packages/ui/src/components/app-shell.tsx projects/cast/src/components/ui/app-shell.tsx projects/media/src/components/ui/app-shell.tsx
git commit -m "feat(ui): composant AppShell (sidebar suite + cadrage page)"
```

---

## Phase 2 — Adoption media

### Task 4 : media — layout admin via AppShell

**Files:**
- Modify: `projects/media/src/app/(admin)/layout.tsx`
- Delete: `projects/media/src/app/(admin)/admin-nav.tsx`
- Modify: `projects/media/src/app/layout.tsx` (alignement body)

- [ ] **Step 1 : Réécrire le layout admin**

Remplacer le contenu de `projects/media/src/app/(admin)/layout.tsx` par :

```tsx
import { requireUserId } from "@/lib/session";
import { env } from "@/lib/env";
import { AppShell, type NavSection } from "@/components/ui/app-shell";
import { centralUrl } from "@/lib/central-url";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

const sections: NavSection[] = [
  { links: [{ href: "/gallery", label: "Galerie" }] },
  {
    label: "Bibliothèque",
    links: [
      { href: "/templates", label: "Templates" },
      { href: "/styles", label: "Styles" },
      { href: "/style-guides", label: "Chartes" },
      { href: "/brand", label: "Marque" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();
  return (
    <AppShell
      project="Media"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={sections}
      footer={<SignOutButton authUrl={env.AUTH_URL} />}
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
```

- [ ] **Step 2 : Vérifier que `env.APP_ENV` existe côté media**

Run: `grep -n "APP_ENV" projects/media/src/lib/env.ts`
Expected: une ligne déclarant `APP_ENV`. **Si absente**, ajouter dans le schéma zod de `projects/media/src/lib/env.ts` (près des autres champs) : `APP_ENV: z.string().optional(),`

- [ ] **Step 3 : Supprimer l'ancienne nav**

```bash
git rm projects/media/src/app/(admin)/admin-nav.tsx
```

- [ ] **Step 4 : Aligner la classe `<body>` du root layout**

Dans `projects/media/src/app/layout.tsx`, remplacer la ligne `<body ...>` par :

```tsx
      <body className="min-h-screen bg-background text-foreground antialiased">
```

- [ ] **Step 5 : Build media**

Run: `cd projects/media && npm run build`
Expected: build OK, aucune erreur sur `(admin)/layout.tsx`.

- [ ] **Step 6 : Tests media**

Run: `cd projects/media && npm test`
Expected: PASS (72 tests).

- [ ] **Step 7 : Commit**

```bash
git add projects/media
git commit -m "media : layout admin via AppShell partagé"
```

---

## Phase 3 — Adoption cast (suppression navbar, sidebar unique)

### Task 5 : cast — providers next-themes + root layout

**Files:**
- Create: `projects/cast/src/app/providers.tsx`
- Modify: `projects/cast/src/app/layout.tsx`

- [ ] **Step 1 : Créer les providers**

Créer `projects/cast/src/app/providers.tsx` :

```tsx
'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 2 : Câbler providers + homogénéiser le root layout**

Dans `projects/cast/src/app/layout.tsx` : ajouter l'import `import { Providers } from './providers';` puis remplacer le `<html>...</html>` du `return` par :

```tsx
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
```

- [ ] **Step 3 : Build cast (sanity)**

Run: `cd projects/cast && npm run build`
Expected: build OK.

- [ ] **Step 4 : Commit**

```bash
git add projects/cast/src/app/providers.tsx projects/cast/src/app/layout.tsx
git commit -m "cast : providers next-themes + root layout homogénéisé"
```

---

### Task 6 : cast — `(app)` et `(settings)` via AppShell

**Files:**
- Modify: `projects/cast/src/app/(app)/layout.tsx`
- Modify: `projects/cast/src/app/(settings)/layout.tsx`
- Delete: `projects/cast/src/components/layout/app-header.tsx`
- Delete: `projects/cast/src/components/settings/settings-sidebar.tsx`
- Create: `projects/cast/src/app/cast-nav.ts` (sections partagées entre les 2 groupes — DRY)

- [ ] **Step 1 : Définir les sections partagées**

Créer `projects/cast/src/app/cast-nav.ts` :

```ts
import type { NavSection } from '@/components/ui/app-shell';

export const castSections: NavSection[] = [
  { links: [
    { href: '/posts', label: 'Posts' },
    { href: '/calendar', label: 'Calendrier' },
  ] },
  { label: 'Réglages', links: [
    { href: '/settings/brand', label: 'Brand' },
    { href: '/settings/voice', label: 'Voix' },
    { href: '/settings/writing-templates', label: "Templates d'écriture" },
    { href: '/settings/connections', label: 'Connexions' },
  ] },
];
```

- [ ] **Step 2 : Réécrire `(app)/layout.tsx`**

Remplacer le contenu de `projects/cast/src/app/(app)/layout.tsx` par :

```tsx
import { AppShell } from '@/components/ui/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId } from '@/lib/auth/session';
import { centralUrl } from '@/lib/central-url';
import { env } from '@/lib/env';
import { castSections } from '../cast-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <AppShell
      project="Cast"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={castSections}
      footer={
        <a href={env.AUTH_URL} className="hover:text-foreground">
          Déconnexion
        </a>
      }
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
```

- [ ] **Step 3 : Réécrire `(settings)/layout.tsx`**

Remplacer le contenu de `projects/cast/src/app/(settings)/layout.tsx` par :

```tsx
import { AppShell } from '@/components/ui/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { requireUserId } from '@/lib/auth/session';
import { centralUrl } from '@/lib/central-url';
import { env } from '@/lib/env';
import { castSections } from '../cast-nav';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <AppShell
      project="Cast"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={castSections}
      footer={
        <a href={env.AUTH_URL} className="hover:text-foreground">
          Déconnexion
        </a>
      }
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
```

- [ ] **Step 4 : Supprimer la navbar et l'ancienne sidebar settings**

```bash
git rm projects/cast/src/components/layout/app-header.tsx
git rm projects/cast/src/components/settings/settings-sidebar.tsx
```

- [ ] **Step 5 : Vérifier qu'aucun autre fichier n'importe les composants supprimés**

Run: `cd projects/cast && grep -rn "app-header\|settings-sidebar" src`
Expected: aucun résultat. *(Si un import subsiste, le retirer.)*

- [ ] **Step 6 : Build + tests cast**

Run: `cd projects/cast && npm run build && npm test`
Expected: build OK ; PASS (169 tests).

- [ ] **Step 7 : Commit**

```bash
git add projects/cast
git commit -m "cast : sidebar unique (AppShell) sur (app) et (settings), suppression navbar"
```

---

## Phase 4 — Migration complète ressources

### Task 7 : ressources — dépendances + root layout + providers

**Files:**
- Modify: `projects/ressources/package.json`
- Modify: `projects/ressources/app/layout.tsx`
- Create: `projects/ressources/app/providers.tsx`

- [ ] **Step 1 : Mettre à jour les dépendances**

Run:
```bash
cd projects/ressources && npm uninstall geist && npm install next-themes@^0.4.6
```
Expected: `geist` retiré, `next-themes` ajouté dans `package.json`.

- [ ] **Step 2 : Créer les providers**

Créer `projects/ressources/app/providers.tsx` :

```tsx
'use client';

import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
```

- [ ] **Step 3 : Réécrire le root layout (fonts next/font/google + providers)**

Remplacer le contenu de `projects/ressources/app/layout.tsx` par :

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ressources — AVQN",
  description: "Ressources pour approfondir l'IA, l'automatisation et le cloud.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4 : Commit**

```bash
git add projects/ressources/package.json projects/ressources/package-lock.json projects/ressources/app/layout.tsx projects/ressources/app/providers.tsx
git commit -m "ressources : fonts next/font + providers next-themes"
```

---

### Task 8 : ressources — tokens @contentos/ui + sync composants

**Files:**
- Create: `projects/ressources/styles/ui-tokens.css`
- Modify: `projects/ressources/app/globals.css`
- Vendorés: `components/ui/*`, `lib/utils.ts`, `lib/central-url.ts`, `components/ui/app-shell.tsx`

- [ ] **Step 1 : Copier les tokens canoniques**

Run:
```bash
cp packages/ui/src/styles/tokens.css projects/ressources/styles/ui-tokens.css
```

- [ ] **Step 2 : Remplacer globals.css par les imports standards**

Remplacer **tout** le contenu de `projects/ressources/app/globals.css` par :

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "../styles/ui-tokens.css";
```

- [ ] **Step 3 : Vérifier que les deps CSS existent**

Run: `grep -E "tw-animate-css|shadcn" projects/ressources/package.json`
Expected: les deux présents. **Si absents**, `cd projects/ressources && npm install tw-animate-css shadcn` *(versions alignées sur media : `grep -E "tw-animate-css|shadcn" projects/media/package.json`)*.

- [ ] **Step 4 : Synchroniser @contentos/ui dans ressources (arbo racine)**

Run: `bin/ui-sync ressources`
Expected: lignes `✓ components/ui/button.tsx`, `✓ components/ui/card.tsx`, `✓ components/ui/sidebar.tsx`, `✓ components/ui/app-shell.tsx`, `✓ lib/utils.ts`, `✓ lib/central-url.ts`, etc. (chemins **sans** `src/`).

- [ ] **Step 5 : Vérifier la non-dérive**

Run: `bin/ui-sync --check ressources`
Expected: `✓ projects/ressources est à jour avec @contentos/ui`.

- [ ] **Step 6 : Commit**

```bash
git add projects/ressources/styles/ui-tokens.css projects/ressources/app/globals.css projects/ressources/components/ui projects/ressources/lib/utils.ts projects/ressources/lib/central-url.ts
git commit -m "ressources : tokens @contentos/ui + composants synchronisés"
```

---

### Task 9 : ressources — migration des classes brutalistes

Mapping déterministe **brutaliste → standard** (à appliquer dans tous les fichiers ci-dessous) :

| Brutaliste | Standard |
|---|---|
| `bg-paper` | `bg-background` |
| `bg-paper-2` | `bg-muted` |
| `text-ink` | `text-foreground` |
| `text-ink-soft` | `text-muted-foreground` |
| `border-ink` | `border-border` |
| `border-2` | `border` |
| `shadow-brutal-sm` | `shadow-sm` |
| `shadow-brutal-lg` | `shadow-lg` |
| `shadow-brutal-accent` | `shadow` |
| `shadow-brutal` | `shadow` |
| `bg-accent-soft` | `bg-accent` |
| `bg-accent` | `bg-primary` |
| `text-accent-ink` | `text-primary-foreground` |
| `text-accent` | `text-primary` |
| `border-accent` | `border-primary` |
| `font-mono` | *(supprimer)* |
| `uppercase`, `tracking-widest`, `tracking-[...]` *(décoratif sur labels/nav)* | *(supprimer)* |
| `press` | *(supprimer)* |
| `rounded-none` | *(supprimer — radius standard)* |

> Ordre important : remplacer `shadow-brutal-*` **avant** `shadow-brutal`, et `bg-accent-soft`/`text-accent-ink` **avant** `bg-accent`/`text-accent` (préfixes).

- [ ] **Step 1 : Supprimer le wordmark brutaliste**

```bash
git rm projects/ressources/components/brand/logo.tsx
```

- [ ] **Step 2 : Migrer `components/admin/page-tree-editor.tsx`**

Appliquer le mapping ci-dessus à toutes les classes du fichier. Vérifier après coup :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" projects/ressources/components/admin/page-tree-editor.tsx`
Expected: aucun résultat.

- [ ] **Step 3 : Migrer `components/admin/module-form.tsx`**

Appliquer le mapping. Vérifier :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" projects/ressources/components/admin/module-form.tsx`
Expected: aucun résultat.

- [ ] **Step 4 : Migrer `app/admin/page.tsx`**

Appliquer le mapping. **Note** : ce fichier référence `logo` ? Vérifier `grep -n "brand/logo" projects/ressources/app/admin/page.tsx` — s'il importe le logo supprimé, retirer l'import et l'usage (le titre passe en texte simple `<h1 class="text-lg font-semibold">Admin</h1>`). Puis vérifier :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" projects/ressources/app/admin/page.tsx`
Expected: aucun résultat.

- [ ] **Step 5 : Migrer `app/admin/audience/page.tsx`**

Appliquer le mapping. Vérifier :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" projects/ressources/app/admin/audience/page.tsx`
Expected: aucun résultat.

- [ ] **Step 6 : Migrer `app/admin/r/[slug]/page.tsx`**

Appliquer le mapping. Vérifier :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" "projects/ressources/app/admin/r/[slug]/page.tsx"`
Expected: aucun résultat.

- [ ] **Step 7 : Migrer `app/admin/r/[slug]/p/[[...path]]/page.tsx`**

Appliquer le mapping. Vérifier :
Run: `grep -nE "ink|paper|brutal|font-mono|\bpress\b" "projects/ressources/app/admin/r/[slug]/p/[[...path]]/page.tsx"`
Expected: aucun résultat.

- [ ] **Step 8 : Vérifier qu'aucun résidu brutaliste ne subsiste dans tout l'admin**

Run: `cd projects/ressources && grep -rnE "ink|paper|brutal|shadow-brutal|font-mono|\bpress\b|brand/logo" app/admin components/admin`
Expected: aucun résultat (hors faux positifs type mots français contenant « ink » — vérifier visuellement la liste).

- [ ] **Step 9 : Build ressources**

Run: `cd projects/ressources && npm run build`
Expected: build OK. *(Si une erreur surgit sur un export de composant ui — ex. prop absente sur `Card`/`Button` standard — adapter l'usage à l'API standard de `@contentos/ui` au point d'appel.)*

- [ ] **Step 10 : Commit**

```bash
git add projects/ressources/app projects/ressources/components
git commit -m "ressources : migration des classes brutalistes vers les tokens partagés"
```

---

### Task 10 : ressources — layout admin via AppShell

**Files:**
- Modify: `projects/ressources/app/admin/layout.tsx`

- [ ] **Step 1 : Vérifier `APP_ENV` côté ressources**

Run: `grep -n "APP_ENV" projects/ressources/lib/env.ts`
Expected: une ligne. **Si absente**, ajouter `APP_ENV: z.string().optional(),` au schéma zod de `projects/ressources/lib/env.ts`.

- [ ] **Step 2 : Réécrire le layout admin**

Remplacer le contenu de `projects/ressources/app/admin/layout.tsx` par :

```tsx
import { requireOperator } from "@/lib/auth/operator"
import { signOutAction } from "@/lib/actions/account"
import { env } from "@/lib/env"
import { AppShell, type NavSection } from "@/components/ui/app-shell"
import { centralUrl } from "@/lib/central-url"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperator()
  const sections: NavSection[] = [
    { links: [
      { href: "/admin", label: "Bord" },
      { href: "/admin/audience", label: "Audience" },
    ] },
    { label: "Public", links: [
      { href: `/o/${op.handle}`, label: "Espace ↗" },
    ] },
  ]
  return (
    <AppShell
      project="Ressources"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={sections}
      footer={
        <form action={signOutAction}>
          <button type="submit" className="hover:text-foreground">
            Déconnexion
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  )
}
```

> Note : `/admin` est préfixe de `/admin/audience` → l'item « Bord » serait actif sur les deux. Acceptable pour cette passe (cohérent avec le comportement `startsWith` des autres projets) ; un `exact` sur l'AppShell est une amélioration future hors périmètre.

- [ ] **Step 3 : Build + tests ressources**

Run: `cd projects/ressources && npm run build && npm test`
Expected: build OK ; PASS (81 tests).

- [ ] **Step 4 : Commit**

```bash
git add projects/ressources/app/admin/layout.tsx projects/ressources/lib/env.ts
git commit -m "ressources : layout admin via AppShell partagé"
```

---

## Phase 5 — Vérification finale & push

### Task 11 : Vérification globale

- [ ] **Step 1 : Non-dérive ui-sync sur les 3 projets**

Run: `for p in cast media ressources; do bin/ui-sync --check $p; done`
Expected: `✓ ... est à jour` pour les trois.

- [ ] **Step 2 : Builds des 3 projets**

Run: `for p in cast media ressources; do (cd projects/$p && npm run build) || echo "BUILD KO: $p"; done`
Expected: aucun « BUILD KO ».

- [ ] **Step 3 : Tests des 3 projets**

Run: `for p in cast media ressources; do (cd projects/$p && npm test) || echo "TEST KO: $p"; done`
Expected: cast 169, media 72, ressources 81 ; aucun « TEST KO ».

- [ ] **Step 4 : Lint (best-effort)**

Run: `(cd projects/cast && npm run lint); (cd projects/ressources && npm run lint)`
Expected: pas de nouvelle erreur introduite par la migration. *(Corriger les éventuels imports inutilisés laissés par les suppressions.)*

- [ ] **Step 5 : Push (preview)**

Run: `git push -u origin claude/wonderful-tesla-Gpzf6`
Expected: branche poussée.

- [ ] **Step 6 : Revue visuelle sur preview**

Ouvrir les previews `cast`, `media`, `ressources` :
- Sidebar identique avec « Contentos » en haut (lien) + nom du projet.
- cast : plus de navbar horizontale ; sidebar présente sur posts/calendar **et** settings.
- ressources : aucun résidu brutaliste dans l'admin, cadrage identique aux autres.

---

## Self-review (couverture spec)

- §1 AppShell → Task 3 (+ adoption Tasks 4, 6, 10). ✓
- §2 centralUrl preview-aware + caveat → Task 2 (+ commentaire dans le helper). ✓
- §3 root layout/providers/fonts homogènes → Task 4 (media body), Task 5 (cast), Task 7 (ressources). ✓
- §4 ui-sync arbo racine → Task 1. ✓
- §5 migration ressources (globals, composants, logo, ~11 fichiers, layout) → Tasks 7-10. ✓
- §6 cast (suppression navbar + settings-sidebar, sidebar unique) & media → Tasks 4, 6. ✓
- §7 routing léger (layout serveur → AppShell, cadrage unique, pas de renommage d'URL) → respecté dans tous les layouts. ✓
- §Vérif (ui-sync --check, builds, tests) → Task 11. ✓

Pas de placeholder. Types cohérents : `NavSection`/`NavLink` définis Task 3, réutilisés Tasks 4/6/10 ; `castSections` Task 6 ; `centralUrl` Task 2 partout.
