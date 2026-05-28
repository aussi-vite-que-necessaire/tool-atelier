# Lot 9 — Bibliothèque de modules étendue (8 nouveaux types)

## Contexte

Le système de modules (lot 1) est extensible par registre (type → schéma Zod + composant +
entrée d'union MCP + champ admin). Pour des lead magnets et guides riches, 8 types manquent.
On les ajoute tous, avec coloration syntaxique (Shiki) pour `code` et des formulaires admin
dynamiques complets.

## Objectif

L'agent (MCP) et l'admin (builder) peuvent créer 8 nouveaux modules : `code`, `prompt`,
`accordion`, `steps`, `comparison`, `quote`, `cta`, `gallery`. Rendu propre dans le reader
brutaliste, édition manuelle complète dans le builder.

## Périmètre

- 8 types : schéma Zod + composant de rendu + entrée registre + entrée `moduleInputSchema`.
- Coloration syntaxique **Shiki** (SSR, singleton mis en cache) pour `code` + bouton « Copier ».
- **Formulaires admin dynamiques** pour tous, y compris ajout/suppression de lignes pour les
  types tableaux (`steps`, `comparison`, `gallery`).
- Refonte du `ModuleForm` admin : le composant client construit l'objet `content` en état et le
  sérialise en JSON ; le server action valide via `moduleInputSchema`. Unifie tous les types
  (simples et tableaux).

Hors lot : tracking des clics CTA (extension stats ultérieure), modules imbriqués arbitraires
dans `steps`, thèmes de code multiples. Aucune migration (`modules.content` = jsonb).

## Schémas (`lib/modules/schemas.ts`)

Ajouts à `moduleContentSchemas` :

| Type | `content` |
| --- | --- |
| `code` | `{ language: string, code: string, filename?: string }` |
| `prompt` | `{ prompt: string, title?: string }` |
| `accordion` | `{ title: string, md: string, open?: boolean }` |
| `steps` | `{ steps: { title: string, md: string }[] }` (≥1) |
| `comparison` | `{ columns: { title: string, md: string }[] }` (2 à 3) |
| `quote` | `{ text: string, author?: string, source?: string, url?: string }` |
| `cta` | `{ label: string, url: string, variant?: "primary" \| "secondary" }` |
| `gallery` | `{ images: { url: string, alt?: string, caption?: string }[] }` (≥1) |

`moduleInputSchema` (`lib/resources/module-input.ts`) : une entrée d'union discriminée par type
pour chacun.

## Rendu (`components/modules/`)

- `lib/modules/highlighter.ts` : highlighter Shiki **singleton** (promesse mémoïsée),
  thème clair brutaliste (`github-light`), langages courants chargés + repli `plaintext` pour
  un langage inconnu. Expose `highlight(code, language): Promise<string>` (HTML).
- `components/modules/copy-button.tsx` (**client**) : bouton « Copier » → presse-papier, état
  « Copié ✓ ». Réutilisé par `code` et `prompt`.
- `code-module.tsx` (**async, serveur**) : en-tête (filename + langage), HTML coloré par Shiki,
  `CopyButton` avec le code brut. Bordure brutaliste.
- `prompt-module.tsx` : encadré « Prompt » (+ titre optionnel), texte en pré-formaté,
  `CopyButton` « Copier le prompt ».
- `accordion-module.tsx` : `<details>` natif (`open` selon le champ) + `<summary>` titre +
  `Markdown(md)`.
- `steps-module.tsx` : liste ordonnée numérotée ; chaque étape = numéro + titre + `Markdown(md)`.
- `comparison-module.tsx` : grille 2-3 colonnes (empilées sur mobile), chaque colonne = titre +
  `Markdown(md)`.
- `quote-module.tsx` : citation + attribution (auteur — source liée si `url`).
- `cta-module.tsx` : lien-bouton stylé selon `variant` (primary = plein, secondary = bordure).
- `gallery-module.tsx` : grille d'images (`<img>` R2) + légendes.
- `registry.tsx` : ajout des 8 au `switch` de `ModuleView`.

## Édition admin (`components/admin/module-form.tsx`)

Refonte : `ModuleForm` (client) gère `content` en état React et le sérialise dans un champ
caché `content` (JSON) à la soumission. Éditeurs par type :

- simples (`code`, `prompt`, `accordion`, `quote`, `cta`) : champs texte / zones de texte /
  select (variant, langage).
- tableaux (`steps`, `comparison`, `gallery`) : éditeur de lignes avec **Ajouter / Supprimer /
  monter-descendre** (état tableau), chaque ligne ayant ses champs.

Les server actions `addModuleAction` / `updateModuleAction` lisent le champ `content` (JSON),
puis valident via `moduleInputSchema` (`validateModuleInput`). `buildModuleContent` (lot 5)
est remplacé par ce flux unifié (les anciens types simples passent par le même chemin).

## Dépendance

`shiki` (ajout à `package.json`). Coloration au build du rendu serveur ; le singleton évite de
réinitialiser le highlighter à chaque requête.

## Tests

Vitest (logique pure) :

- `validateModuleInput` : étendre avec un cas valide et un cas invalide par nouveau type
  (langage manquant sur code, colonnes hors 2-3 sur comparison, url invalide sur cta/gallery…).
- Pas de test de rendu Shiki (intégration) ; vérification visuelle via le reader.

## Critères d'acceptation

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` passent.
2. Les 8 types sont créables via MCP (`add_module` / `create_resource`) et rendus correctement
   dans le reader (code coloré + bouton copier, accordéon repliable, steps numérotés,
   comparison en colonnes, quote, cta, gallery).
3. Le builder admin édite les 8 types, avec ajout/suppression de lignes pour les types tableaux.
4. Déployé en prod (redéploiement, aucune migration).
