# Spec 28 — Types de variables complets sur le MCP des templates visuels

## Problème

Le DSL des templates visuels (`src/lib/visual-templates/dsl.ts`) définit quatre
types de variables : `string`, `image`, `list`, `color`. La validation, le rendu
Handlebars (`{{#each}}` pour les listes, substitution directe pour les couleurs),
le stockage JSONB, le formulaire des réglages et les tests unitaires gèrent les
quatre.

Les outils MCP `create_visual_template` et `update_visual_template`
(`src/lib/mcp/tools/visuals.ts`) n'exposent que `string` et `image`. Le schéma
d'entrée est un sous-ensemble écrit à la main :

```ts
const variableSpecInput = z
  .object({ name: z.string(), label: z.string(), type: z.enum(['string', 'image']) })
  .passthrough();
```

Deux conséquences :

1. L'énumération `['string', 'image']` rejette `list` et `color` à la frontière
   MCP, avant même d'atteindre le validateur du DSL.
2. Les champs spécifiques à chaque type ne sont que tolérés via `.passthrough()`,
   donc absents du JSON Schema présenté au client MCP. Le modèle ne voit que
   `name`/`label`/`type` et ignore l'existence des listes — il se rabat sur une
   chaîne multiligne pour rendre une arborescence.

Le schéma d'entrée MCP est un doublon qui a divergé du DSL.

## Objectif

Le MCP réutilise le schéma canonique du DSL comme unique source de vérité. Les
quatre types de variables — avec leurs champs spécifiques et leurs descriptions —
sont exposés au client MCP, qui peut créer et mettre à jour des templates
utilisant des listes et des couleurs.

## Conception

### `src/lib/visual-templates/dsl.ts`

- Exporter la valeur `variableSpecSchema` (l'union discriminée), qui n'expose
  aujourd'hui que ses types inférés. C'est l'unique changement du DSL.

### `src/lib/mcp/tools/visuals.ts`

- Importer `variableSpecSchema` depuis le DSL. `variableSpecInput` cesse d'être
  un sous-ensemble énum écrit à la main : il devient un alias exporté du schéma
  canonique (`export const variableSpecInput = variableSpecSchema`), réutilisé par
  les deux outils — `variablesSchema: z.array(variableSpecInput)` (et `.optional()`
  pour l'update) — et importable par les tests pour vérifier la frontière.
- Ajouter une `.describe()` sur ce champ `variablesSchema` pour que le JSON Schema
  soit auto-documenté et que le modèle choisisse une liste plutôt qu'une chaîne
  multiligne. Le texte rappelle les quatre types et leur usage : `string` (texte),
  `image` (mediaId de la galerie), `list` (tableau de chaînes rendu via
  `{{#each}}`), `color` (hex `#rrggbb`). Les champs requis par type sont déjà
  encodés par l'union discriminée elle-même.
- Conserver l'appel `parseVariablesSchema(input.variablesSchema)` : il ajoute la
  vérification d'unicité des noms (`superRefine`) que le type tableau seul ne
  couvre pas.

La validation se fait désormais à la frontière MCP avec les champs requis par
type (ex. `max` obligatoire pour `string`, `default` hex optionnel pour `color`).

## Tests

Test-first, ciblant la frontière réellement modifiée — le schéma d'entrée MCP,
pas seulement `visualImpl` (qui accepte déjà les quatre types via
`parseVariablesSchema`).

- Le schéma exposé par les outils visuels accepte une variable `list` (avec
  `minItems`/`maxItems`/`itemMax`) et une variable `color` (avec `default` hex).
- Il rejette une variable malformée (ex. `type` inconnu, ou `string` sans `max`).
- Un test d'intégration `visualImpl.createTemplate` → `getTemplate` avec un
  schéma contenant `list` + `color` confirme le cycle complet (specs reparsées
  intactes).

## Hors périmètre

- Aucune migration DB : le JSONB stocke déjà n'importe quelle forme.
- Aucun changement d'UI : le formulaire des réglages gère déjà les quatre types.
- Aucun changement de rendu : Handlebars gère déjà listes et couleurs.
