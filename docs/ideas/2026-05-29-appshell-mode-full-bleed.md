# Mode full-bleed dans l'AppShell partagé — idée en backlog

Née de la refonte du calendrier de cast (spec
`projects/cast/docs/superpowers/specs/2026-05-29-calendrier-fullbleed-drawer-design.md`).
Capturée pour ne pas refaire le même bricolage à chaque fois.

## Contexte (29/05/2026)

L'`AppShell` partagé (`packages/ui/src/components/app-shell.tsx`, synchronisé dans 5 projets
par `bin/ui-sync`) impose à **tout** son contenu un conteneur centré et borné :

```tsx
<main className="min-w-0 flex-1 overflow-x-clip">
  <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
</main>
```

Une page qui veut occuper **toute la zone de contenu** (à droite de la sidebar, jusqu'aux
bords, pleine hauteur) — calendrier, tableau de bord, éditeur plein écran — doit donc
s'échapper de ce conteneur. Le calendrier de cast le fait avec un panneau `fixed` ancré sur
`left-60` (largeur de la sidebar), ce qui **couple le projet aux constantes internes de
l'AppShell** (largeur sidebar, hauteur top-bar `h-14`). Fragile si l'AppShell change.

## L'idée — une variante full-bleed de l'AppShell

Quand **2+ projets** auront une page full-bleed (cast calendrier + p. ex. un dashboard
`media`/`ressources`), exposer dans l'AppShell un moyen propre d'opter pour le plein cadre,
au lieu que chaque page bricole un `fixed left-60` :

- soit une prop (`<AppShell contentClassName=…>` ou `fullBleed`) qui retire le conteneur borné ;
- soit un composant `AppShellFullBleedSlot` que la page rend pour signaler « je gère mon
  conteneur » ;
- soit exposer une **CSS variable** `--app-content-left` (largeur sidebar) + `--app-content-top`
  (hauteur top-bar) que les pages full-bleed consomment, pour découpler des constantes en dur.

Avantages :

- Plus de constantes `left-60` / `top-14` dupliquées dans les projets.
- Robuste si la sidebar change de largeur.
- Pattern réutilisable, cohérent avec la philosophie « composants partagés `packages/ui` ».

Tradeoffs :

- Touche les 5 projets (re-sync `bin/ui-sync`) — d'où le déclencheur « quand 2+ projets en ont
  besoin », pas avant.
- Risque de sur-généraliser un besoin encore unique (YAGNI).

## Déclencheur

**Quand un 2ᵉ projet a besoin d'une page full-bleed sous l'AppShell**, généraliser ici plutôt
que de copier le `fixed left-60` de cast.
