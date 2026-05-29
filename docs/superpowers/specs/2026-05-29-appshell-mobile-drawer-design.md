# AppShell — navigation mobile (drawer)

**Date** : 2026-05-29
**Statut** : validé, prêt pour plan d'implémentation
**Périmètre** : `packages/ui`, projets `cast`, `media`, `ressources`, `styleguide`

## Contexte & objectif

Depuis l'homogénéisation de la suite (cf. `2026-05-29-appshell-suite-design.md`), les
trois outils applicatifs (`cast`, `media`, `ressources`) partagent le même cadre
`AppShell` de `@contentos/ui`, qui pose une **sidebar latérale** à gauche.

Problème : la primitive `Sidebar` est `sticky top-0 h-screen w-60` **toujours visible**.
Sur mobile (écran étroit) elle ampute l'espace horizontal du contenu et ne se replie
pas — il n'y a aucun moyen de la masquer/révéler. L'expérience mobile des trois apps en
souffre.

Objectif : sur mobile, **masquer la sidebar** et la rendre accessible via un **bouton
en haut** (hamburger) qui l'ouvre en **drawer** (panneau coulissant en overlay). Sur
desktop, comportement inchangé. Correction faite dans le design system (`packages/ui`),
propagée aux trois projets par `bin/ui-sync`.

## Décisions de design

### 1. Le comportement responsive vit dans `AppShell`, pas dans `Sidebar`

`Sidebar` (et ses sous-composants `SidebarHeader/Section/Item/Footer`) reste une
**primitive composable pure** : le styleguide la réutilise dans son propre shell, avec
un layout différent. On ne lui ajoute pas d'état d'ouverture ni de logique de drawer.

C'est `AppShell` — l'unité réellement consommée par les trois apps — qui orchestre le
responsive. **Aucun changement d'API** : `AppShell({ project, homeUrl, sections, footer,
children })` reste identique ; les trois projets gagnent le drawer sans toucher leurs
layouts.

### 2. Anti-duplication : `SidebarNav` interne

Le contenu de navigation (lien « Contentos » + nom du projet, `sections` → `SidebarItem`,
`footer`) est aujourd'hui inline dans `AppShell`. On l'extrait dans un composant **interne**
à `app-shell.tsx` (non exporté), `SidebarNav`, rendu **à l'identique** :

- dans la `Sidebar` statique desktop ;
- dans le `Drawer` mobile.

Ainsi un seul endroit décrit la nav. `SidebarNav` reçoit `project`, `homeUrl`, `sections`,
`footer`, `pathname`, et un callback optionnel `onNavigate` (utilisé par le drawer pour se
fermer au clic sur un lien).

### 3. Layout responsive

Breakpoint : `lg` (1024px), cohérent avec le shell du styleguide qui utilise déjà
`hidden lg:flex`.

- **Desktop (`lg:` et plus)** :
  - `Sidebar` statique visible (`hidden lg:flex`), inchangée.
  - Top-bar mobile masquée (`lg:hidden`).
- **Mobile (`< lg`)** :
  - `Sidebar` statique masquée.
  - **Top-bar** sticky en haut (`lg:hidden`), `h-14`, `border-b`, fond
    `bg-background/80` + `backdrop-blur` (même registre que le header du styleguide) :
    - à gauche, le **bouton hamburger** : `Button variant="ghost" size="icon"` avec
      l'icône `MenuIcon` de `lucide-react` (déjà utilisé par `dialog.tsx`), `aria-label`
      « Ouvrir la navigation » ;
    - à côté, le libellé « Contentos · {project} » (lien « Contentos » → `homeUrl`,
      `project` en `font-semibold`).
  - Le contenu (`main`) garde son padding ; il occupe toute la largeur.

### 4. Drawer = base-ui `Dialog` ancré à gauche

On réutilise la primitive `Dialog` de `@base-ui/react/dialog` (déjà dans la lib via
`dialog.tsx`) — backdrop, `Esc`, focus-trap et scroll-lock gratuits. On **n'ajoute pas**
de nouveau composant exporté : le drawer est monté **inline** dans `app-shell.tsx` (c'est
un détail d'implémentation du shell, pas un organisme réutilisable de plus à maintenir).

- État `open` via `React.useState` au niveau d'`AppShell`. La top-bar est le trigger,
  le drawer est contrôlé (`open`/`onOpenChange`).
- **Backdrop** : `Dialog.Backdrop` `fixed inset-0 z-50 bg-black/20 backdrop-blur-xs`,
  animations `data-open:animate-in data-open:fade-in-0` / `data-closed:animate-out
  data-closed:fade-out-0` (calqué sur `DialogOverlay`).
- **Popup** : `Dialog.Popup` ancré à gauche, `fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw]`,
  fond `bg-sidebar text-sidebar-foreground border-r border-sidebar-border`, scroll
  vertical, animations `data-open:slide-in-from-left` / `data-closed:slide-out-to-left`
  + fade (utilitaires fournis par `tw-animate-css`, déjà importé). Bouton de fermeture
  (`XIcon`, `Dialog.Close`) en haut à droite du panneau.
- Le panneau rend `<SidebarNav … onNavigate={() => setOpen(false)} />` : cliquer un lien
  navigue **et** ferme le drawer.

### 5. Accessibilité

- Bouton hamburger : `aria-label` explicite ; base-ui `Dialog.Trigger` gère
  `aria-haspopup`/`aria-expanded`.
- Le drawer porte un `Dialog.Title` visuellement masqué (`sr-only`, p.ex. « Navigation »)
  pour nommer le dialogue.
- Focus-trap, restitution du focus au trigger, fermeture `Esc` : fournis par base-ui.

### 6. Propagation & vitrine

1. Édition de `packages/ui/src/components/app-shell.tsx` (source canonique). Pas de
   nouveau fichier de composant ni de nouvelle entrée dans les `mappings` de `bin/ui-sync`.
2. `bin/ui-sync cast media ressources styleguide` pour vendorer la nouvelle version
   (en-tête `@generated`). `bin/ui-sync --check` doit ensuite passer pour chacun.
3. **Styleguide** : ajout d'une démo encadrée « Navigation mobile » dans
   `styleguide.tsx`, montrant la top-bar + le bouton qui ouvre le drawer (contenue dans
   un cadre, état local), pour documenter le pattern dans le design system.

## Hors périmètre

- Le shell **propre** au projet `styleguide` (son `<Sidebar className="hidden lg:flex">`
  custom) n'est pas refait ici : on documente le pattern via une démo, sans réécrire la
  vitrine elle-même.
- Pas de persistance d'état (cookie), pas de sidebar collapsible sur desktop, pas de
  rail — YAGNI. On traite uniquement le besoin mobile (masquer/révéler).

## Vérification

`packages/ui` n'a pas de harnais de test unitaire (source copiée façon shadcn). La
vérification s'appuie sur :

- `bin/ui-sync --check <projet>` (zéro dérive après resync) pour les quatre projets ;
- type-check / build des projets impactés (au minimum `cast` et `styleguide`, dont l'env
  de dev se monte sans Docker) ;
- vérification visuelle sur la **preview** de la branche (`*-<branche>.preview.contentos.ch`) :
  largeur mobile → top-bar + hamburger → drawer s'ouvre/ferme, lien ferme le drawer ;
  largeur desktop → sidebar statique inchangée.
