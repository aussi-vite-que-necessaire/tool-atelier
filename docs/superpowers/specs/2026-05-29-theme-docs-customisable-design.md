# Thème de docs customisable — design

**Date** : 2026-05-29
**Projets touchés** : `ressources` (admin/back-office) et `docs` (site public user-facing)

## Problème

La partie user-facing (`docs`) a aujourd'hui un design figé : les tokens de design
(`--paper`, `--ink`, `--accent`, ombres, radius…) sont codés en dur dans
`globals.css`, identiques pour tous les espaces. On veut que chaque opérateur puisse
**piloter et brander** le rendu de ses docs depuis les réglages : nom de marque,
choix d'un thème preset, et personnalisation fine de ses tokens.

## Principe directeur

**Un thème = un jeu de tokens, rien d'autre.** Aucun composant ne connaît un thème ;
ils consomment uniquement des variables CSS. Personnaliser revient à produire un autre
jeu de tokens et à l'injecter en `:root`. Les presets sont juste des jeux de tokens
nommés, ajoutables en éditant un fichier.

## Granularité

**Par espace / operator.** Le thème s'applique à tout l'espace public d'un opérateur
(`/o/[handle]/…`). Le per-resource est une évolution future hors périmètre.

## Modèle de données

Type canonique `ThemeTokens` (schéma Zod), jeu complet de tokens :

- **Couleurs** : `paper`, `paper2`, `ink`, `inkSoft`, `accent`, `accentInk`,
  `accentSoft`, `info`, `success`, `warn`
- **Typographie** : `fontSans`, `fontMono` (valeurs choisies dans un allowlist de
  familles)
- **Forme** : `radius` (ex. `"0"`, `"0.5rem"`), `shadowStyle` (`"brutal"` =
  ombres dures décalées ↔ `"soft"` = ombres floues)

Les ombres (`--shadow-brutal*`) sont **dérivées** de `shadowStyle` + `ink`/`accent`
lors de la génération CSS — elles ne sont pas stockées token par token.

Stockage sur la table `operators` (migration Drizzle) :

- `brand_name text` (nullable) — nom de marque affiché dans l'en-tête public ;
  fallback sur `name` si absent.
- `theme jsonb` (nullable) — `{ preset: string, overrides: Partial<ThemeTokens> }`.

Le thème effectif = **tokens du preset choisi, écrasés par les overrides**.
`theme = null` → preset par défaut `brutalist` (= rendu actuel). Rétrocompatible :
les espaces existants ne changent pas d'apparence.

## Cœur partagé : `lib/theme/`

Dossier créé dans `ressources/lib/theme/` puis **dupliqué dans `docs/lib/theme/`**
(même convention que `db/schema/` : copie synchronisée côté public read-only).

- `tokens.ts` — schéma Zod `themeTokensSchema`, type `ThemeTokens`, allowlist des
  polices, `defaultThemeConfig`.
- `presets.ts` — `presets: Record<string, ThemeTokens>` + métadonnées (id, label).
  4 presets au départ : `brutalist`, `modern`, `dark`, `editorial`.
- `resolve.ts` :
  - `resolveTheme(config: ThemeConfig): ThemeTokens` — merge preset + overrides,
    valide via Zod, retombe sur le défaut si preset inconnu.
  - `themeToCss(tokens: ThemeTokens): string` — génère le bloc CSS
    (`--paper: …; --ink: …; … --shadow-brutal: …;`) à injecter en `:root`,
    incluant les ombres dérivées de `shadowStyle`.

## Presets initiaux (jeux de tokens)

- **brutalist** — l'actuel : papier/encre chauds, accent orange, `radius 0`,
  `shadowStyle: brutal`.
- **modern** — fonds clairs neutres, accent bleu/violet, `radius 0.75rem`,
  `shadowStyle: soft`.
- **dark** — fond sombre, texte clair, accent vif, `radius 0.5rem`,
  `shadowStyle: soft`.
- **editorial** — sobre, `fontSans` serif, contraste élevé, `radius 0.25rem`,
  `shadowStyle: soft`.

Enrichir = ajouter une entrée dans `presets.ts`.

## Settings UI (ressources) — `/admin/settings`

Nouvelle route admin :

- Champ **nom de marque** (`brand_name`).
- Sélecteur de **preset** (cartes cliquables, 4 presets).
- Éditeur de **tokens** (overrides au-dessus du preset) :
  - couleurs : `<input type="color">` par token couleur,
  - typo : `<select>` police sans / mono depuis l'allowlist,
  - forme : slider/`<select>` radius + toggle `shadowStyle`.
- **Aperçu live** : une carte-lecteur d'exemple rendue avec les tokens résolus,
  mise à jour en temps réel (client component, applique `themeToCss` inline).
- **Sauvegarde** via server action → met à jour l'operator (`brand_name`, `theme`).
- Lien « Réglages » ajouté dans la nav admin (`app/admin/layout.tsx`).

Validation server-side via `themeTokensSchema` avant écriture en base.

## Injection côté docs

Les pages publiques résolvent déjà l'operator via le `handle` de l'URL
(`/o/[handle]/…`). On :

1. charge `brand_name` + `theme` de l'operator,
2. injecte un `<style>` contenant `:root{ themeToCss(resolveTheme(theme)) }` en haut
   du `ReaderShell` et de la page d'espace,
3. affiche `brand_name` (fallback `name`) dans l'en-tête public.

`globals.css` reste le fallback (defaults brutalist) ; le `<style>` injecté écrase
au runtime.

## Tests (TDD)

Cœur (logique pure, priorité) dans `ressources` :

- `resolveTheme` : résout un preset seul ; applique des overrides partiels ;
  retombe sur le défaut pour un preset inconnu ; rejette des tokens invalides (Zod).
- `themeToCss` : produit les variables attendues ; dérive correctement les ombres
  selon `shadowStyle` (snapshot stable).
- presets : les 4 presets valident contre `themeTokensSchema`.
- server action de save : valide et persiste `brand_name` + `theme` ; rejette un
  payload invalide.

## Hors périmètre (évolutions futures)

- Thème par ressource (override au niveau resource).
- Import/export de thème, partage entre opérateurs.
- Upload de polices custom (on reste sur un allowlist).
- Mode auto light/dark selon préférence visiteur.
