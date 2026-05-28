# Spec 12 — Visuels pilotables via MCP — Design

**Objectif** : permettre à un agent (via MCP) de gérer les templates et styles visuels de bout en bout — inspecter les paramètres attendus, créer/éditer des templates, et générer une image en remplissant les bons params.

## Problème

Côté MCP (Spec 11), les visuels sont en lecture seule : `list_visual_templates`, `list_visual_styles`, et `render_visual` (génération). L'agent ne peut pas **créer/éditer** un template visuel, et n'a pas d'exposition propre des **paramètres attendus** par template (seulement le schéma brut renvoyé par `list`).

## Périmètre

Ajouts au serveur MCP existant (aucune migration, façade sur les repos déjà présents) :

1. **`get_visual_template {id}`** — renvoie le template + ses **specs de variables parsées** (`parseVariablesSchema` → `{ name, label, type, ... }[]`) + `sampleVars`. C'est ce qui permet à l'agent de savoir exactement quels params remplir.
2. **`create_visual_template`** / **`update_visual_template`** / **`delete_visual_template`** — l'agent crée/édite un template (slug, label, platform, width, height, bodyHtml, css, variablesSchema, sampleVars). Le `variablesSchema` est validé via `parseVariablesSchema` → erreur claire si mal formé.
3. **`create_visual_style`** / **`update_visual_style`** / **`delete_visual_style`** — gestion des styles d'image IA (`{ name, prompt }`). `list_visual_styles` existe déjà.
4. **`render_visual`** : ajouter une **pré-validation** des vars contre le schéma du template (`variablesSchemaToZod(parseVariablesSchema(t.variablesSchema), { imagesOptional: false }).parse(vars)`) → erreur immédiate et lisible avant d'enfiler le job.

Cohésion : regrouper tous les tools visuels (les `list_*` existants + les nouveaux) dans `src/lib/mcp/tools/visuals.ts`. `render_visual` reste dans `media.ts` (proche de generate/edit image) mais gagne la pré-validation.

Hors périmètre : éditeur visuel WYSIWYG, prévisualisation d'image via MCP (l'agent peut générer puis `list_gallery_images` pour l'URL).

## Comportement

- `create_visual_template` : valide `variablesSchema` (parse DSL) ; en cas d'échec, renvoie une erreur explicite sans rien créer. Renvoie le template créé.
- `get_visual_template` : si introuvable → erreur. Sinon `{ ...template, variableSpecs }`.
- `render_visual` : valide les vars ; vars invalides → erreur lisible (message zod) sans enfiler de job. Sinon comportement inchangé (enfile + attend l'image).
- Styles : CRUD direct via repos, scopé au user.

## Tests

- **Integration** (`test/integration/mcp-tools-visuals.test.ts`) :
  - `create_visual_template` puis `get_visual_template` → `variableSpecs` reflète le schéma fourni ; `list_visual_templates` contient le nouveau.
  - `create_visual_template` avec `variablesSchema` invalide → throw (rien créé).
  - `update_visual_template` / `delete_visual_template`.
  - `create_visual_style` puis `list_visual_styles` ; `update` / `delete`.
- **Integration `render_visual` pré-validation** : vars invalides (champ requis manquant) → throw sans enqueue (runner injecté non appelé) ; vars valides + runner injecté → renvoie le résultat.
- **Vérification manuelle** : via MCP, créer un template, l'inspecter, générer une image, lister la galerie.
