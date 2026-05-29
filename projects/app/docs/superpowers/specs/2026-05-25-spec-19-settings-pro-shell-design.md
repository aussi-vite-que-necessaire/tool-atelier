# Spec 19 — Espace Settings « pro »

## Objectif

Donner aux réglages un espace dédié et moderne : sidebar pleine hauteur collée au bord gauche de l'écran, langage visuel « cartes douces » cohérent sur toutes les pages, et un éditeur de visual templates repensé pour être lisible et compact.

## Contexte

Aujourd'hui les réglages vivent dans le shell global de l'app (`(app)/layout.tsx` : barre de nav horizontale + `<main className="max-w-6xl mx-auto p-6">`). `settings/layout.tsx` y pose une sidebar dans un conteneur centré. Résultat : sidebar non collée au bord, espace central étriqué, et un éditeur de templates où chaque variable est un gros bloc vertical (scroll infini) et où le code HTML/CSS domine.

## Périmètre

- Shell dédié pour `/settings/**` (plein écran, sidebar full-height).
- Restyle « cartes douces » de **toutes** les pages settings, pour la cohérence.
- Refonte de l'éditeur de visual templates (lignes de variables compactes, code repliable).

Hors périmètre : le reste de l'app (idées/posts/galerie/calendrier garde son shell actuel) ; aucune nouvelle donnée, table ou API ; pas de réordonnancement des variables (l'ordre n'a pas d'importance).

## Architecture

### Shell dédié `(settings)`

Settings sort du groupe `(app)` pour ne plus hériter du header global. On déplace `app/(app)/settings/**` vers un nouveau groupe **`app/(settings)/settings/**`**. Les URLs `/settings/...` sont inchangées (les groupes entre parenthèses ne comptent pas dans l'URL).

- `app/(settings)/layout.tsx` : refait l'auth (redirect `/signin` si pas de session), rend un shell plein écran `min-h-screen` à deux zones : **sidebar full-height collée à gauche** + zone de contenu scrollable à droite. Inclut le `<Toaster />`.
- La sidebar contient : le logo `content-os` (lien vers `/`) en haut, les entrées de réglages, et **« ← Retour à l'app »** en bas (lien vers `/`). Plus de nav globale (Idées/Posts/Galerie/Calendrier) dans Settings.
- L'item actif est mis en valeur (carte blanche surélevée), via `usePathname` (la sidebar reste un client component, comme aujourd'hui).

Le déplacement conserve les imports : alias `@/...` inchangés ; imports relatifs internes au sous-arbre settings préservés (le sous-arbre bouge d'un bloc).

### Langage visuel « cartes douces » (mono)

Appliqué à toutes les pages settings :
- Fond gris doux (`bg-neutral-100`/`zinc-100`), contenu en **cartes blanches** (coins arrondis `rounded-xl`, bordure fine, ombre légère, padding généreux).
- Sidebar claire ; item actif = carte blanche surélevée ; items inactifs gris, hover discret.
- En-tête de page : libellé discret « Réglages », titre, sous-titre, puis les cartes.
- **Palette mono conservée** : accent noir (`neutral-900`), pas de couleur d'accent introduite.

Un composant de présentation réutilisable `SettingsPage` (en-tête : title + description) et `SettingsCard` (carte titrée) standardisent les pages. Les pages existantes (Brand, Voix, Templates d'écriture, Visual styles, Connexions, Clés API) sont ré-habillées avec ces primitives, sans changer leur logique.

### Éditeur de visual templates (deux colonnes)

`visual-template-form.tsx` : grille deux colonnes, **aperçu live sticky à droite** (déjà en place), formulaire à gauche structuré en cartes :

- **Carte Identité** : Nom, Slug, Plateforme (lecture seule), Width, Height — disposition compacte en ligne.
- **Carte Variables** : chaque variable est une **ligne compacte** affichant puce de type (texte/image/liste/couleur), `name`, label, et un résumé des contraintes (ex. « 30–220 », « opt »). Clic sur la ligne → **déplie** l'édition fine (description, min/max, optional, défaut couleur) ; re-clic referme. Bouton « + Ajouter une variable » (la nouvelle ligne s'ouvre dépliée). Pas de réordonnancement.
- **Carte Code (HTML / CSS)** : repliée par défaut (`<details>`), HTML et CSS en monospace à l'intérieur.
- **Carte Sample vars (JSON)** : repliable.
- Colonne droite : aperçu HTML live (recompilé à la frappe via l'action draft existante). L'aperçu image PNG reste accessible sur la page d'édition (carte/section dédiée sous le formulaire).

`VariablesSchemaEditor` garde sa logique (état, sérialisation JSON dans le hidden input, `onChange` pour l'aperçu live) ; seule la présentation change : lignes repliables au lieu de blocs toujours dépliés. Labels et `name` des champs **préservés** (compat E2E).

## Composants

Création :
- `app/(settings)/layout.tsx` — shell plein écran + auth.
- `components/settings/settings-shell.tsx` (ou intégré au layout) — structure sidebar + contenu.
- `components/settings/settings-page.tsx`, `settings-card.tsx` — primitives de présentation (en-tête, carte).

Modification :
- `components/settings/settings-sidebar.tsx` — logo + entrées + retour app, style cartes douces.
- `visual-template-form.tsx` — passage en cartes + variables en lignes repliables.
- `variables-schema-editor.tsx` — présentation en lignes compactes repliables.
- Pages settings existantes — ré-habillage via `SettingsPage`/`SettingsCard`.

Suppression :
- `app/(app)/settings/**` (déplacé vers `(settings)`).
- `app/(app)/settings/layout.tsx` (remplacé par le shell `(settings)`).

## Tests

- `tsc`, `biome`, build.
- E2E Playwright adaptés : settings-brand, settings-editorial, settings-api-keys, visual-templates — les URLs `/settings/...` sont inchangées, donc l'essentiel des sélecteurs tient ; vérifier la sidebar (logo, entrées), le shell, et l'éditeur (lignes de variables : le champ d'une variable peut nécessiter de déplier la ligne d'abord → adapter les specs `template-image-var` et `visual-templates` qui remplissent Name/Label/Max).
- Check visuel ensemble (densité, repli du code par défaut, rendu des cartes).

## Risques

- **Déplacement de route** : risque de casser des imports relatifs ou des liens. Mitigation : déplacer le sous-arbre d'un bloc, vérifier `tsc` + build + E2E (URLs inchangées).
- **Variables repliables** : les E2E qui remplissent les champs d'une variable doivent d'abord déplier la ligne ; adapter les sélecteurs.
- Double `<Toaster />` si le layout `(app)` et `(settings)` en rendent chacun un — ok car les arbres sont disjoints (une page est dans l'un ou l'autre).
