# AppShell partagé + homogénéisation de la suite

**Date** : 2026-05-29
**Statut** : validé, prêt pour plan d'implémentation
**Périmètre** : `packages/ui`, `bin/ui-sync`, projets `cast`, `media`, `ressources`

## Contexte & objectif

Le styleguide partagé `@contentos/ui` (source canonique dans `packages/ui`, vendorée
par `bin/ui-sync` façon shadcn) a déjà été adopté par `cast` et `media`. On veut aller
vers un **maximum d'homogénéité** entre les outils de la suite : un cadre applicatif
(*AppShell*) **identique** partout, une sidebar commune avec en haut un lien vers le
site central (`contentos.ch`), et commencer à migrer `ressources` dans le styleguide.

État de départ (divergences constatées) :

| | cast | media | ressources |
|---|---|---|---|
| Fonts | `next/font/google` Geist | `next/font/google` Geist | `geist/font` (paquet) |
| Providers (dark) | aucun | next-themes | aucun |
| `suppressHydrationWarning` | non | oui | non |
| Garde d'auth | `requireUserId()` | `requireUserId()` | `requireOperator()` (DB) |
| Routing | `(app)` + `(settings)` | `(admin)` | `/admin` (pas de groupe) |
| Sidebar | 2 (app = navbar horizontale, settings = sidebar) | 1 (`admin-nav`) | 0 (header horizontal) |
| Thème UI | tokens `@contentos/ui` | tokens `@contentos/ui` | brutaliste maison (`--ink`/`--paper`/`shadow-brutal`) |
| Arbo | `src/` | `src/` | racine (`app/`, `components/`, `lib/`) |

`docs` (public, ex-scission de `ressources`) **reste hors périmètre** : il conserve son
identité brutaliste publique.

## Décisions de design

### 1. `AppShell` — organisme présentationnel dans `@contentos/ui`

Nouveau composant `packages/ui/src/components/app-shell.tsx` (`'use client'`), vendoré
par `ui-sync`. Il pose **tout** le cadre applicatif, identique pour les 3 projets.

API :

```tsx
<AppShell
  project="Cast"                    // identité affichée (titre sous le lien Contentos)
  homeUrl={centralUrl(env.APP_ENV)} // lien « Contentos » preview-aware, calculé serveur
  sections={[                       // nav déclarative, 100% sérialisable (texte, pas d'icônes)
    { links: [{ href: '/posts', label: 'Posts' }, { href: '/calendar', label: 'Calendrier' }] },
    { label: 'Réglages', links: [{ href: '/settings/brand', label: 'Brand' }, /* … */] },
  ]}
  footer={<SignOut authUrl={env.AUTH_URL} />}  // ReactNode : chaque projet garde sa mécanique de logout
>
  {children}
</AppShell>
```

Rendu (identique partout) :
- `<div class="flex min-h-screen">`
- `<Sidebar>` dont le haut est un **`SidebarBrand`** : lien « Contentos » (→ `homeUrl`,
  retour à la suite) puis le **nom du projet** en titre. Suit avec les `sections`
  (`SidebarSection` + `SidebarItem`) et le `footer` poussé en bas.
- `<main>` au **cadrage homogène** (max-width + padding standardisés, ex.
  `mx-auto w-full max-w-6xl px-6 py-8 sm:px-8` — valeur définitive fixée à
  l'implémentation, une seule source).
- `<Toaster>`.

État actif : `usePathname()` en interne (préfixe `startsWith`).

**Couplage Next assumé** : l'`AppShell` importe `next/link` et `next/navigation`
directement. Les primitives `Sidebar` restent agnostiques (prop `render`), mais
l'AppShell *est* le shell Next de l'application — le coupler à Next est légitime et
supprime tout boilerplate par projet. Conséquence : `packages/ui` doit pouvoir résoudre
les types `next` pour le typecheck (peer/dev dep à ajouter si nécessaire).

**Items texte uniquement** (convention déjà en place dans `media/admin-nav` et la
sidebar settings de `cast`) → `sections` entièrement sérialisable, donc passable depuis
un layout **serveur** vers ce composant client.

`SidebarBrand` peut être soit un sous-composant interne à `app-shell.tsx`, soit ajouté
aux primitives `sidebar.tsx` ; choix laissé à l'implémentation (par défaut : interne à
l'AppShell pour garder les primitives Next-agnostiques).

### 2. Lien « Contentos » preview-aware — helper `centralUrl()`

Nouveau `packages/ui/src/lib/central-url.ts` (synced) :

```ts
export function centralUrl(appEnv?: string): string {
  if (!appEnv || appEnv === 'prod') return 'https://contentos.ch';
  return `https://www-${appEnv}.preview.contentos.ch`;
}
```

Déterministe depuis `APP_ENV` (injecté par `deploy.sh` : `'prod'` en prod, sinon le slug
de branche). Pas de parsing de host, calculé côté serveur dans chaque layout puis passé
en prop `homeUrl`.

**Caveat assumé** : en preview, le lien vise `www-<branche>.preview.contentos.ch`, qui
n'existe que si `www` a été déployé sur cette branche (`deploy.sh` ne build que les
projets modifiés). S'il n'existe pas, le lien est mort → **accepté tel quel**, ce n'est
pas grave en contexte de revue de preview. Robustification (build systématique de `www`)
prévue plus tard, via une future branche « preview » intégrant tout avant la prod —
**hors périmètre**.

### 3. Homogénéisation root layout / providers / fonts

Pour `cast`, `media`, `ressources` :
- **Fonts** → `next/font/google` Geist (`ressources` abandonne le paquet `geist/font`).
  Variables `--font-geist-sans` / `--font-geist-mono` identiques (compatibles avec les
  références existantes dans les `globals.css`).
- **Providers** → tous reçoivent `next-themes`
  (`<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`)
  et `<html suppressHydrationWarning>`. Les tokens dark deviennent fonctionnels partout.
  *(Toggle visible = optionnel, hors périmètre pour cette passe.)*
- **`<body>`** → mêmes classes : `min-h-screen bg-background text-foreground antialiased`.

### 4. `ui-sync` — support de l'arbo racine

`ressources` (et `docs`) utilisent une arbo **racine** (pas de `src/`). `bin/ui-sync`
mappe aujourd'hui vers des chemins `src/...`. Évolution :
- Auto-détection : si `projects/<p>/src/` **n'existe pas**, strippe le préfixe `src/`
  des chemins cibles (`src/components/ui/button.tsx` → `components/ui/button.tsx`,
  `src/lib/utils.ts` → `lib/utils.ts`, `src/styles/ui-tokens.css` → `styles/ui-tokens.css`).
- Zéro config par projet. `--check` doit fonctionner avec la même logique.
- Bénéficie à `docs` pour une future migration.

### 5. Migration `ressources` (complète)

- `app/globals.css` : **remplacer** le bloc brutaliste (`--ink`/`--paper`/`--paper-2`/
  `shadow-brutal*`/`--radius: 0`/`* { border-color }`/`body { background }`) par les
  tokens `@contentos/ui` (import du `ui-tokens.css` synced + imports framework standards :
  `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, puis `./styles/ui-tokens.css`).
- Composants UI maison `components/ui/{button,badge,card}.tsx` → remplacés par les
  versions synchronisées depuis `@contentos/ui` (+ ajout des composants nécessaires :
  `sidebar`, `sonner`, etc. selon usage).
- `components/brand/logo.tsx` (wordmark brutaliste) → supprimé, remplacé par le
  `SidebarBrand` de l'AppShell.
- Les ~11 fichiers utilisant le brutaliste (`app/admin/*`, `components/admin/*`) :
  `border-ink` / `bg-paper` / `shadow-brutal*` / `font-mono` / `press` / `uppercase
  tracking` → classes et tokens standards (`border`, `bg-background`/`bg-muted`,
  `shadow-sm`, etc.).
- `app/admin/layout.tsx` → rendu via `<AppShell project="Ressources" …>` ; la garde
  `requireOperator()` reste dans le layout serveur, le `footer` câble la déconnexion
  existante (server action `signOutAction`).
- **`docs` reste brutaliste** — non touché.

### 6. Migration `cast` & `media`

- **media** : `(admin)/layout.tsx` rend `<AppShell project="Media" …>` à la place de
  `admin-nav.tsx` (qui est supprimé). Sections reprises de l'`admin-nav` actuel
  (Galerie + Bibliothèque : Templates, Styles, Chartes, Marque). Footer =
  `SignOutButton` existant. Garde `requireUserId()` conservée.
- **cast** :
  - Suppression de la navbar horizontale `components/layout/app-header.tsx`.
  - `(app)/layout.tsx` **et** `(settings)/layout.tsx` rendent le **même** `<AppShell>`
    (sections : `[Posts, Calendrier]` + `Réglages: [Brand, Voix, Templates d'écriture,
    Connexions]`) → sidebar identique sur toute l'app.
  - Suppression de `components/settings/settings-sidebar.tsx`.
  - Footer = lien déconnexion vers `AUTH_URL`. Gardes `requireUserId()` conservées.

### 7. Routing — homogénéisation légère

Convention partagée : **un seul endroit monte l'AppShell** par zone authentifiée
(layout serveur : garde → `<AppShell>`). On **ne renomme pas** les URLs publiques
(risqué) ; on unifie le *cadrage* des pages (toutes héritent du même `<main>` via
l'AppShell, suppression des `max-w-*`/`p-*` ad hoc dans les layouts) et le pattern
« layout serveur (garde) → AppShell ». Restructuration plus profonde des routes
(ex. fusionner les groupes de `cast`) = **hors périmètre**, étape future.

## Vérification (definition of done)

- `bin/ui-sync --check <projet>` vert pour `cast`, `media`, `ressources`.
- `npm test` vert sur les 3 (ardoise actuelle : cast 169, media 72, ressources 81).
- `npm run build` vert sur les 3.
- Revue visuelle sur preview après push : sidebar identique, lien Contentos présent en
  haut, cadrage des pages homogène, `ressources` sans résidu brutaliste dans l'admin.

## Hors périmètre (notés pour plus tard)

- Robustification du lien preview (build systématique de `www` / branche « preview »
  intégrant tout avant prod).
- Toggle dark mode visible dans la sidebar.
- Migration de `docs` (public) vers `@contentos/ui`.
- Restructuration profonde du routing (renommage de segments, fusion de groupes).
