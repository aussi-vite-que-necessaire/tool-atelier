# Refonte du calendrier — full-bleed + drawer d'aperçu

**Date :** 2026-05-29
**Projet :** cast
**Statut :** validé (brainstorm)

## Contexte

La suite contentos a adopté une sidebar de navigation à gauche (`AppShell` partagé,
`packages/ui`). La page calendrier de cast utilise un breakout « full-bleed » historique
(`w-screen` + marges négatives calculées sur le centre du viewport) qui **déborde derrière la
sidebar** à gauche et au-delà du bord droit : le breakout suppose un contenu centré dans le
viewport, alors que le calendrier vit dans `<main>` (zone à droite de la sidebar `w-60`).

Objectif : le calendrier doit occuper **toute la zone de contenu** (à droite de la sidebar,
jusqu'au bord droit, en touchant le haut et le bas), avec un **maximum d'espace** et un
**minimum de hauteur perdue**, sans s'écraser sur petit écran. Au clic sur un post, ouvrir un
**drawer par-dessus** le calendrier (et non un panneau qui pousse la grille).

## Décisions (brainstorm)

- Navigation des mois : **barre fine** en haut (option B) — mois à gauche, `‹ ›` + bouton
  **« Aujourd'hui »** à droite. **Pas de légende** (couleurs bleu = planifié / vert = publié
  considérées explicites).
- Aperçu : **drawer overlay à droite** avec **pied fixe** (option D).

## Architecture

### 1. Cadrage full-bleed — panneau `fixed` (local à cast)

Le `layout.tsx` du calendrier remplace le breakout viewport par un **panneau `fixed`** ancré
sur la zone de contenu, à droite de la sidebar :

- desktop (`lg`+) : `fixed inset-y-0 right-0 left-60` (15rem = largeur de `Sidebar`, sticky à
  gauche dans l'`AppShell`) ;
- mobile (`< lg`) : sidebar masquée, top-bar `h-14` sticky → `fixed top-14 inset-x-0 bottom-0`.

L'`AppShell` (flex, `min-h-screen`, sans `transform`) place la sidebar comme premier enfant
flex au bord gauche du viewport ; `left-60` correspond donc exactement au début de `<main>`.
Le contenu en flux du conteneur `max-w-6xl` de l'`AppShell` se réduit à du vide (le panneau est
sorti du flux) — pas de scroll fantôme car le panneau couvre la zone.

**Alternative écartée :** ajouter un mode full-bleed à l'`AppShell` partagé (`packages/ui`) —
plus réutilisable mais impacte 5 projets pour un besoin propre à cast. Noté en backlog
(`docs/ideas/`).

### 2. Grille pleine hauteur — `month-calendar.tsx`

Structure `flex h-full flex-col` :

1. **barre fine** (flex-none, ~40px) — cf. §3 ;
2. **en-têtes des jours** (Lun…Dim, flex-none) ;
3. **zone des semaines** (`min-h-0 flex-1 overflow-y-auto`) contenant la grille
   `grid-cols-7` dont les lignes (`weeks.length`, soit 4 à 6 selon le mois) se partagent la
   hauteur à parts égales avec une **hauteur minimale** par ligne (~120px) :
   `grid-template-rows: repeat(weeks.length, minmax(120px, 1fr))`.

Comportement : sur grand écran les lignes s'étirent pour remplir la hauteur ; sur petit écran,
quand `weeks.length × 120px` dépasse la hauteur disponible, la zone **scrolle** au lieu
d'écraser les cellules. Le cap d'items par cellule (`slice(0, 4)` + `+N`) est conservé ;
chaque cellule reste `overflow-hidden`.

### 3. Barre fine — remplace le titre

Retire le bloc en-tête actuel (`<h1>{label}</h1>` + flèches). Nouvelle barre :

- gauche : libellé du mois capitalisé (« mai 2026 ») — texte simple, pas un `<h1>` proéminent ;
- droite : `‹` (mois précédent) · `›` (mois suivant) · **« Aujourd'hui »** (lien vers
  `/calendar`, sans `?month` → mois courant via `parseMonthParam(undefined)`).

Navigation toujours pilotée par l'URL `?month=YYYY-MM` (`<Link>`, inchangé).

### 4. Drawer d'aperçu — overlay par-dessus le calendrier

Archi conservée : parallel route `@modal` + intercepting route `(.)preview/[postId]`, URL
`/calendar/preview/[postId]`, fermeture Échap / retour navigateur. Fallback page directe
inchangé.

**`preview-sidebar.tsx` → drawer overlay (client) :**
- `fixed inset-y-0 right-0`, glisse depuis la droite, sur **toutes** les tailles (suppression
  du mode « sticky in-flow » desktop) ;
- **scrim** assombri (`fixed inset-0 bg-black/20`) cliquable pour fermer, sur toutes les tailles ;
- largeur : `w-full max-w-md` (mobile pleine largeur, ~28rem desktop) ;
- bouton **fermer ✕** flottant en haut à droite ; **plus d'en-tête « Aperçu du post »** ;
- le panneau donne à `children` un conteneur **pleine hauteur** (`h-full`) — le scroll et le
  pied fixe sont gérés par le contenu (§ ci-dessous), pas par le drawer.

**`post-preview-pane.tsx` → contenu (server) :** `flex h-full flex-col`
- **zone scrollable** (`min-h-0 flex-1 overflow-y-auto`) : `LinkedInPostPreview` plein panneau,
  sans carte « Aperçu du post » ;
- **pied fixe** (`flex-none`, bordure haute) :
  - bouton **« Modifier »** pleine largeur (`/posts/{id}`) ;
  - si une publication `published` avec `externalUrl` existe pour ce post (via
    `getLatestPublicationForPost`, ou une variante « dernière publiée »), lien
    **« ↗ Voir le post sur LinkedIn »** (`target="_blank"`, `rel="noopener noreferrer"`).

## Données

Aucune migration. On lit `publications.status` / `publications.externalUrl` via le repository
existant. Si plusieurs publications existent pour un post, on prend la **dernière publiée**
(`status = 'published'`, triée par `publishedAt`/`createdAt` décroissant) pour le lien LinkedIn.

## Tests (TDD)

- `buildMonthGrid` : tests existants conservés (nombre de semaines variable déjà couvert).
- Repository : test « dernière publication publiée avec `externalUrl` pour un post » (lien
  affiché) vs « post non publié » (pas de lien).
- Rendu `PostPreviewPane` : présence du bouton « Modifier » ; lien LinkedIn présent ssi publié
  avec URL.
- Rendu `MonthCalendar` : barre avec libellé du mois + « Aujourd'hui » ; absence de l'ancien
  `<h1>` titre ; cellules de jour rendues.

## Hors périmètre

- Création de post au clic sur un jour vide.
- Drag & drop / replanification.
- Vue semaine / jour.
- Généralisation du full-bleed à l'`AppShell` partagé (backlog).
