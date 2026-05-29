# AppShell — navigation mobile (drawer) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur mobile, masquer la sidebar de l'`AppShell` partagé et la rendre accessible via un bouton hamburger qui l'ouvre en drawer coulissant ; comportement desktop inchangé. Corrigé dans `packages/ui` et propagé aux trois apps + styleguide.

**Architecture:** Le responsive vit dans `AppShell` (l'unité consommée par cast/media/ressources), pas dans la primitive `Sidebar` qui reste pure. Le contenu de nav est factorisé dans un `SidebarNav` interne, rendu à l'identique dans la sidebar desktop et dans un drawer mobile (base-ui `Dialog` ancré à gauche). Re-sync via `bin/ui-sync`, démo ajoutée au styleguide.

**Tech Stack:** Next.js 16 (App Router), `@base-ui/react` (Dialog), `lucide-react` (icônes), Tailwind v4 + `tw-animate-css`, `@contentos/ui` (vendoré par `bin/ui-sync`).

**Note sur la vérification (TDD) :** `packages/ui` n'a **pas** de harnais de test unitaire — c'est une source copiée façon shadcn, sans runner. Il n'existe donc pas de « test rouge » à écrire pour ces composants. La discipline de vérification s'appuie ici sur : `bin/ui-sync --check` (zéro dérive), le type-check/build des projets, et la vérification visuelle sur preview. Chaque tâche décrit sa vérification concrète.

Spec : `docs/superpowers/specs/2026-05-29-appshell-mobile-drawer-design.md`.

---

## Structure des fichiers

- `packages/ui/src/components/app-shell.tsx` — **MODIFIÉ** : extraction `SidebarNav`, sidebar desktop `hidden lg:flex`, top-bar mobile + drawer base-ui. Source canonique.
- `projects/{cast,media,ressources,styleguide}/src/components/ui/app-shell.tsx` (ressources : `components/ui/app-shell.tsx`, sans `src/`) — **GÉNÉRÉ** par `bin/ui-sync` (ne pas éditer à la main).
- `projects/styleguide/src/components/styleguide/styleguide.tsx` — **MODIFIÉ** : démo « Navigation mobile ».

`bin/ui-sync` n'a **pas** besoin de nouvelle entrée `mappings` (on modifie un fichier déjà géré, pas de nouveau composant).

---

## Task 1 : Réécrire `AppShell` (packages/ui) — sidebar desktop + top-bar/drawer mobile

**Files:**
- Modify: `packages/ui/src/components/app-shell.tsx` (remplacement complet)

- [ ] **Step 1 : Remplacer intégralement le contenu du fichier**

Écrire dans `packages/ui/src/components/app-shell.tsx` :

```tsx
'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
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
 * Contenu de navigation partagé entre la sidebar desktop et le drawer mobile.
 * Interne au shell : un seul endroit décrit l'en-tête, les sections et le footer.
 * `onNavigate` permet au drawer de se fermer au clic sur un lien.
 */
function SidebarNav({
  project,
  homeUrl,
  sections,
  footer,
  pathname,
  onNavigate,
}: {
  project: string;
  homeUrl: string;
  sections: NavSection[];
  footer?: ReactNode;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
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
              render={<Link href={link.href} onClick={onNavigate} />}
            >
              {link.label}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </>
  );
}

/**
 * AppShell — cadre applicatif partagé de la suite contentos.
 *
 * Desktop (≥ lg) : sidebar statique à gauche, contenu cadré à droite.
 * Mobile (< lg) : sidebar masquée, une top-bar sticky offre un bouton hamburger
 * qui ouvre la même navigation dans un drawer (base-ui Dialog ancré à gauche) ;
 * cliquer un lien navigue et referme le drawer. Présentationnel : la garde
 * d'auth reste dans le layout serveur, qui passe `homeUrl` et une nav déclarative.
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
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      {/* Sidebar statique — desktop uniquement */}
      <Sidebar className="hidden lg:flex">
        <SidebarNav
          project={project}
          homeUrl={homeUrl}
          sections={sections}
          footer={footer}
          pathname={pathname}
        />
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          {/* Top-bar — mobile uniquement */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-background/80 px-4 backdrop-blur lg:hidden">
            <DialogPrimitive.Trigger
              render={
                <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation" />
              }
            >
              <MenuIcon />
            </DialogPrimitive.Trigger>
            <span className="text-sm">
              <a
                href={homeUrl}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Contentos
              </a>
              <span className="text-muted-foreground"> · </span>
              <span className="font-semibold text-foreground">{project}</span>
            </span>
          </header>

          {/* Drawer — mobile uniquement */}
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left lg:hidden">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <DialogPrimitive.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-3 right-3"
                    aria-label="Fermer la navigation"
                  />
                }
              >
                <XIcon />
              </DialogPrimitive.Close>
              <SidebarNav
                project={project}
                homeUrl={homeUrl}
                sections={sections}
                footer={footer}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <main className="min-w-0 flex-1 overflow-x-clip">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier la cohérence des primitives utilisées**

Confirmer que les API référencées existent (lecture rapide) :
- `Button` accepte `variant="ghost"`, `size="icon"`, `size="icon-sm"` → `packages/ui/src/components/button.tsx` (cva : variants `ghost`, sizes `icon`/`icon-sm`).
- Pattern `render={<Button … />}` sur un primitif base-ui → déjà utilisé dans `packages/ui/src/components/dialog.tsx` (`DialogPrimitive.Close render={<Button … />}`).
- `MenuIcon`, `XIcon` exportés par `lucide-react` (`XIcon` déjà importé par `dialog.tsx`).

Attendu : aucune incohérence. (Pas de commande — revue visuelle du diff.)

- [ ] **Step 3 : Commit**

```bash
git add packages/ui/src/components/app-shell.tsx
git commit -m "feat(ui): drawer mobile pour AppShell (sidebar repliée < lg)"
```

---

## Task 2 : Propager aux projets via `bin/ui-sync` + vérifier l'absence de dérive

**Files:**
- Generated (modifiés par le script) :
  - `projects/cast/src/components/ui/app-shell.tsx`
  - `projects/media/src/components/ui/app-shell.tsx`
  - `projects/ressources/components/ui/app-shell.tsx`
  - `projects/styleguide/src/components/ui/app-shell.tsx`

> Note : `styleguide` n'utilise pas `AppShell` dans son shell, mais le fichier est géré par `ui-sync` (présent dans `src/components/ui/`). On le resynchronise pour que `--check` reste vert et que la démo puisse l'importer si besoin.

- [ ] **Step 1 : Synchroniser les quatre projets**

Run :
```bash
bin/ui-sync cast && bin/ui-sync media && bin/ui-sync ressources && bin/ui-sync styleguide
```
Attendu : chaque exécution réécrit `…/app-shell.tsx` avec l'en-tête `@generated`, sortie sans erreur (exit 0).

- [ ] **Step 2 : Vérifier zéro dérive**

Run :
```bash
bin/ui-sync --check cast && bin/ui-sync --check media && bin/ui-sync --check ressources && bin/ui-sync --check styleguide
```
Attendu : exit 0 pour les quatre (aucune dérive entre source et copies).

- [ ] **Step 3 : Commit**

```bash
git add projects/cast/src/components/ui/app-shell.tsx \
        projects/media/src/components/ui/app-shell.tsx \
        projects/ressources/components/ui/app-shell.tsx \
        projects/styleguide/src/components/ui/app-shell.tsx
git commit -m "chore(ui): resync app-shell vers cast/media/ressources/styleguide"
```

---

## Task 3 : Démo « Navigation mobile » dans le styleguide

**Files:**
- Modify: `projects/styleguide/src/components/styleguide/styleguide.tsx`

- [ ] **Step 1 : Ajouter les imports nécessaires**

En tête de `styleguide.tsx`, dans l'import lucide existant (ligne 3), ajouter `MenuIcon` et `XIcon` :

```tsx
import { ArrowRightIcon, MenuIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
```

Et ajouter, sous les imports de composants ui, l'import du primitif Dialog de base-ui :

```tsx
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
```

(placer cet import avec les autres imports de paquets en haut, p. ex. juste après la ligne `import { toast } from 'sonner';`).

- [ ] **Step 2 : Ajouter l'entrée de sommaire**

Dans le tableau `sections` (≈ ligne 40-51), ajouter une entrée juste après `{ id: 'sidebar', label: 'Sidebar' }` :

```tsx
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'nav-mobile', label: 'Navigation mobile' },
```

- [ ] **Step 3 : Ajouter le composant de démo**

Juste après la fonction `SidebarPreviewSection()` (qui se termine ≈ ligne 377), ajouter :

```tsx
function MobileNavSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Muted>
        Sur mobile, l'AppShell replie la sidebar derrière une top-bar : le bouton
        hamburger ouvre la navigation dans un drawer coulissant. Cliquer un lien
        referme le drawer. Sur desktop (≥ lg) la sidebar reste affichée.
      </Muted>

      {/* Aperçu encadré de la top-bar mobile */}
      <div className="overflow-hidden rounded-xl ring-1 ring-border">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border bg-background/80 px-4 backdrop-blur">
            <DialogPrimitive.Trigger
              render={
                <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation" />
              }
            >
              <MenuIcon />
            </DialogPrimitive.Trigger>
            <span className="text-sm">
              <span className="text-muted-foreground">Contentos · </span>
              <span className="font-semibold text-foreground">Cast</span>
            </span>
          </div>
          <div className="bg-background px-4 py-8 text-sm text-muted-foreground">
            Contenu de l'application…
          </div>

          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <DialogPrimitive.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-3 right-3"
                    aria-label="Fermer la navigation"
                  />
                }
              >
                <XIcon />
              </DialogPrimitive.Close>
              <SidebarHeader>
                <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Contentos
                </span>
                <span className="mt-1 block text-lg font-semibold text-sidebar-foreground">
                  Cast
                </span>
              </SidebarHeader>
              <SidebarSection label="Réglages">
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />} active>
                  Brand
                </SidebarItem>
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />}>
                  Voix
                </SidebarItem>
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />}>
                  Connexions
                </SidebarItem>
              </SidebarSection>
              <SidebarFooter>← Retour à l'app</SidebarFooter>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Brancher la section dans le rendu**

Dans le `<main>` de `Styleguide()`, juste après la `<Section id="sidebar" …>` (≈ ligne 459-461), ajouter :

```tsx
          <Section
            id="nav-mobile"
            title="Navigation mobile"
            description="Sur petit écran, l'AppShell replie la sidebar derrière une top-bar et un drawer."
          >
            <MobileNavSection />
          </Section>
```

- [ ] **Step 5 : Commit**

```bash
git add projects/styleguide/src/components/styleguide/styleguide.tsx
git commit -m "docs(styleguide): démo navigation mobile (top-bar + drawer)"
```

---

## Task 4 : Vérification build / type-check

**Files:** aucun (vérification).

- [ ] **Step 1 : Type-check du styleguide (consommateur le plus simple, sans DB)**

Run (depuis `projects/styleguide`) :
```bash
cd projects/styleguide && npx tsc --noEmit
```
Attendu : exit 0, aucune erreur de type (notamment sur l'import base-ui Dialog et les props Button).

Si `tsc` n'est pas configuré standalone, lancer le build Next :
```bash
cd projects/styleguide && npm run build
```
Attendu : build réussi.

- [ ] **Step 2 : Type-check de cast (consommateur d'AppShell)**

Run (depuis `projects/cast`) :
```bash
cd projects/cast && npx tsc --noEmit
```
Attendu : exit 0 — confirme que l'`app-shell.tsx` vendoré compile dans un projet réel qui le consomme.

> Si l'install des deps n'a pas été faite dans le conteneur, lancer `npm ci` au préalable dans le projet concerné. Si l'environnement ne permet pas le type-check (deps absentes, hors périmètre dev), noter l'écart explicitement et s'appuyer sur la vérification visuelle de preview (Step 3) — ne pas prétendre que ça compile sans l'avoir vu.

- [ ] **Step 3 : Vérification visuelle (preview)**

Après push de la branche, ouvrir `https://styleguide-<branche>.preview.contentos.ch` :
- en largeur desktop : section « Navigation mobile » présente, sidebar du styleguide normale ;
- en largeur mobile (devtools responsive) sur une preview applicative (`https://cast-<branche>.preview.contentos.ch`, nécessite session) : top-bar + hamburger visibles, sidebar statique masquée ; clic hamburger → drawer slide-in depuis la gauche ; clic lien → navigue + ferme ; `Esc`/backdrop → ferme ; desktop → sidebar statique inchangée.

---

## Self-Review

**Couverture spec :**
- §1 (responsive dans AppShell, Sidebar pure, API inchangée) → Task 1.
- §2 (SidebarNav interne anti-duplication) → Task 1 Step 1.
- §3 (layout `lg`, top-bar `h-14` sticky, hamburger ghost+MenuIcon, libellé Contentos·project) → Task 1.
- §4 (drawer base-ui inline, backdrop, popup ancré gauche, slide-in, close XIcon, fermeture au clic via onNavigate) → Task 1.
- §5 (a11y : aria-label, Dialog.Title sr-only, focus-trap/Esc base-ui) → Task 1.
- §6 (propagation ui-sync 4 projets + démo styleguide) → Tasks 2 & 3.
- Vérification (--check, build, visuel) → Tasks 2 & 4.

**Placeholders :** aucun TODO/TBD ; tout le code des composants est fourni intégralement.

**Cohérence des types :** `SidebarNav` définit `pathname: string | null` (compatible `usePathname(): string | null`) et `onNavigate?: () => void` ; mêmes noms de props utilisés dans les deux rendus. `NavSection`/`NavLink` inchangés (API AppShell stable). Classes d'animation (`slide-in-from-left`/`slide-out-to-left` + `animate-in`/`animate-out`) cohérentes avec l'usage de `tw-animate-css` dans `select.tsx`/`dialog.tsx`.
