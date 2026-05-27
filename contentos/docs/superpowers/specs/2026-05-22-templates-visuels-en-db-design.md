# Templates visuels en base de données — Design

Date : 2026-05-22
Statut : spec validée (brainstorm), en attente d'écriture du plan d'implémentation.

## Contexte et objectif

Aujourd'hui les templates visuels vivent en code source (`src/visuals/<slug>/index.ts`). Chaque template exporte un objet `VisualTemplate` avec une fonction `render(vars, imageDataUrl?)` qui produit du HTML+CSS via des template literals. Ajouter ou modifier un template nécessite un redéploiement.

Ce chantier déplace les templates en base de données pour permettre la création et l'édition dynamique depuis l'UI, sans redéploiement. Les fonctionnalités fonctionnelles (génération, image IA, brief, rendu Puppeteer) restent identiques.

Ce chantier est le premier d'une migration en quatre étapes vers un SaaS multi-tenant : (3) templates en DB → (1) backend Postgres + Redis → (2) frontend React + UI lib → (4) multi-tenancy + auth + billing. Les choix de design ci-dessous restent compatibles avec la suite mais n'anticipent pas (4) (les templates restent admin-only à l'échelle de l'instance).

## Décisions cadres (validées en brainstorm)

| Décision | Choix retenu |
|---|---|
| Auteurs de templates | Admin de l'instance uniquement, confiance totale (HTML+CSS libre, pas de sandbox) |
| Data binding | Handlebars |
| Structure de stockage | Split `body_html` + `css` + `base_css` global en code |
| Versioning | Single version, save direct (preview obligatoire au save pour garantir l'intégrité) |
| Format schéma variables | JSON Schema draft 2020-12 + annotation custom `x-source` |

## Modèle de données

### Table `visual_templates`

Ajoutée au `db.exec(CREATE TABLE IF NOT EXISTS ...)` de `src/db.ts`. Pas de migration séparée (cohérent avec la philosophie projet : base jetable).

| Colonne | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | identifiant interne |
| `slug` | TEXT UNIQUE NOT NULL | clé stable kebab-case, utilisée par `visuals.template_slug` |
| `label` | TEXT NOT NULL | nom affiché dans l'UI |
| `platform` | TEXT NOT NULL | `linkedin` aujourd'hui, doit appartenir à `PlatformKey` |
| `width` | INTEGER NOT NULL | viewport Puppeteer, 1-10000 |
| `height` | INTEGER NOT NULL | idem |
| `body_html` | TEXT NOT NULL | contenu Handlebars entre `<body>`, sans `<style>` |
| `css` | TEXT NOT NULL | CSS template-specific, sans `@font-face` (factorisé dans `base_css`) |
| `variables_schema` | TEXT NOT NULL | JSON Schema 2020-12, validé via Ajv |
| `sample_vars` | TEXT NOT NULL | JSON valide selon `variables_schema`, sert au preview et à la doc vivante |
| `image_prompt` | TEXT NULL | prompt de style Gemini, NULL = pas d'image IA |
| `image_aspect_ratio` | TEXT NULL | un de `GeminiAspectRatio`, requis si `image_prompt != null` |
| `created_at` | INTEGER NOT NULL | epoch ms |
| `updated_at` | INTEGER NOT NULL | epoch ms |

Index : `CREATE INDEX visual_templates_platform_idx ON visual_templates(platform)` pour le filtre des dropdowns visual par writing template.

### JSON Schema des variables

Format draft 2020-12. Annotation custom `x-source` sur chaque propriété pour router le remplissage :

- `"ai"` : variable fournie par Sonnet en tool_use (filtré dans le schéma envoyé à Sonnet)
- `"user"` : variable user-driven (input UI : color picker, texte, etc.)
- `"image"` : variable injectée par le pipeline Gemini. Convention : nom de variable `image`, présente uniquement quand `image_prompt != null`.

Exemple :

```json
{
  "type": "object",
  "required": ["bigNumber", "context"],
  "properties": {
    "bigNumber": {
      "type": "string",
      "minLength": 1,
      "maxLength": 8,
      "description": "Statistique clé à mettre en avant en typo massive...",
      "x-source": "ai"
    },
    "context": {
      "type": "string",
      "minLength": 20,
      "maxLength": 90,
      "description": "Phrase courte qui explique la stat...",
      "x-source": "ai"
    },
    "subtitle": {
      "type": "string",
      "maxLength": 140,
      "description": "Sous-phrase optionnelle...",
      "x-source": "ai"
    },
    "brandColor": {
      "type": "string",
      "format": "color",
      "default": "#000000",
      "x-source": "user"
    }
  }
}
```

### Couplage avec `visuals` (table existante)

La colonne `visuals.template_slug` reste une simple string, **sans FK contrainte** vers `visual_templates.slug`. Justification : on garde la souplesse de supprimer ou renommer un template sans casser les visuels passés. Si un visuel référence un slug supprimé, l'UI affiche "template introuvable" et propose de re-générer ou détacher.

### `base_css` (en code source)

Fichier `src/visuals/base.css` contient :
- `@font-face` pour Clash Display et General Sans (URLs `cdn.avqn.ch`)
- Reset universel (`* { margin: 0; padding: 0; box-sizing: border-box; }`)

Les dimensions exactes sont appliquées par l'assemblage du doc (inline `style="width:{width}px;height:{height}px"` sur `<body>`) et par le viewport Puppeteer, pas par `base_css`.

Importé par le compilateur au boot via `fs.readFileSync`, concaténé au `css` de chaque template avant assemblage du doc HTML final.

Justification : les fonts sont AVQN-owned et changent à la cadence du déploiement, pas besoin d'édition DB. Promu en DB plus tard si chantier (4) impose un base_css par tenant.

## Pipeline de rendu

### Module `src/visuals/compile.ts`

Nouvelle fonction `compileTemplate(template, vars, imageDataUrl?)` :

1. **Résolution des sources** : pour chaque variable du schema, déterminer si elle vient de `vars` (sources `ai` et `user`) ou de `imageDataUrl` (source `image`). Variable required manquante → throw avec message explicite.
2. **Construction du contexte Handlebars** :
   ```ts
   {
     ...filledVars,
     image: imageDataUrl,              // undefined si pas d'image IA
     brand: { name, color, signature } // depuis settings, exposé automatiquement
   }
   ```
3. **Compilation Handlebars** sur `body_html` ET `css` (utile pour `background-image: url({{image}})`). Cache LRU des templates compilés par clé `slug:updated_at`, taille 50, invalidation automatique au save.
4. **Assemblage du doc final** :
   ```html
   <!doctype html>
   <html>
   <head><meta charset="utf-8"><style>{base_css}\n{compiled_css}</style></head>
   <body style="width:{width}px;height:{height}px">{compiled_body_html}</body>
   </html>
   ```

### Helpers Handlebars custom

Registrés au boot dans `src/visuals/compile.ts` :

- `{{escape value}}` : HTML escape explicite (documentation, Handlebars escape déjà sur double-stash)
- `{{ifNotEmpty list}}...{{/ifNotEmpty}}` : block conditionnel sur liste non-vide
- `{{trim value}}` : trim whitespace, utilisé partout dans les templates actuels

On reste minimal. On ajoute un helper quand un template en a besoin, pas avant.

### Sécurité Handlebars

- Variables AI/user dans `body_html` : **toujours double-stash** `{{var}}` (HTML escape obligatoire, Sonnet et user input ne sont pas trustés au sens XSS).
- Triple-stash `{{{var}}}` : autorisé **uniquement** sur des fragments contrôlés par l'auteur du template (SVG inline conditionnel, fragments HTML statiques). Validé à la revue de chaque template.
- Le `base_css` et le `css` template sont fournis par l'admin de l'instance, qui est de confiance totale (cf. décision cadre).

### Sonnet tool_use schema

`src/visuals/sonnet-schema.ts` : transforme le JSON Schema stocké en filtrant les variables `x-source: "ai"` uniquement (les `user` et `image` sont exclues du prompt Sonnet). Le résultat est passé à `client.messages.create({ tools: [{ name: 'fillVisualVariables', input_schema: ... }] })`.

### Erreurs et fallback

- Template inconnu (slug invalide) → 404 côté HTTP, jamais atteint dans le pipeline.
- Variable required manquante au compile → idée passe `failed` avec le nom de la variable.
- Handlebars compile error (template cassé par admin) → idée passe `failed` avec le message Handlebars. (En théorie impossible si le preview au save fonctionne, cf. UI section.)
- Gemini fail (image impossible) → comportement actuel préservé : post créé sans image, idée reste `used`. Le template doit gérer `{{#if image}}{{else}}...{{/if}}` quand applicable.

### Modifications du pipeline existant

- `produceVisual()` dans `src/generate.ts` : remplace l'appel `template.render(filled, imageDataUrl)` par `compileTemplate(template, filled, imageDataUrl)`. Reste du flot inchangé (brief, Gemini, screenshot).
- `regenerateImageOnly()` : même changement.
- `getVisualTemplate(slug)` : refactor pour aller chercher en DB au lieu du registre statique `visualTemplates` de `src/visuals/index.ts`.
- `listVisualTemplates(platform?)` : nouvelle fonction qui retourne les templates DB filtrés par plateforme. Remplace l'itération sur le registre statique partout dans les vues.

## UI d'administration des templates

La page `/visual-templates` devient un CRUD complet (aujourd'hui elle ne fait que lister + rendre un placeholder).

### Routes

| Verbe | Route | Rôle |
|---|---|---|
| `GET` | `/visual-templates` | Liste : thumbnail + slug + platform. Bouton "Nouveau". |
| `GET` | `/visual-templates/:slug` | Page d'édition. |
| `GET` | `/visual-templates/new` | Page de création (formulaire vide). |
| `POST` | `/visual-templates` | Création. |
| `PATCH` | `/visual-templates/:slug` | Update partiel (un champ par save inline ou groupé à l'enregistrement explicite). |
| `DELETE` | `/visual-templates/:slug` | Suppression. Bloquée si `visuals` référence le slug (compteur affiché). Confirmation modale (`confirmModal`). |
| `POST` | `/visual-templates/:slug/preview` | Compile + render PNG. Body : payload de variables. Retourne le PNG. |
| `GET` | `/visual-options` | Existant, doit lire en DB désormais. |

### Forme de la page d'édition

Quatre onglets (parité minimale, polish viendra avec chantier 2 frontend) :

- **Métadonnées** : `label`, `platform` (select sur `PlatformKey`), `width`/`height`, `image_prompt` (textarea), `image_aspect_ratio` (select).
- **HTML** : textarea monospace pour `body_html`.
- **CSS** : textarea monospace pour `css`.
- **Variables** : textarea JSON brute pour `variables_schema`. Validation Ajv au save. L'éditeur visuel viendra avec le chantier frontend.

Panneau preview à droite :
- Bouton "Régénérer preview (sample)" : compile avec `sample_vars`, render placeholder image, screenshot.
- Bouton "Régénérer avec vars réelles" : input texte → Sonnet `fillVisualVariables` → preview. Optionnel, utile pour stresser le template.

### Validation au save

Toutes les règles ci-dessous, dans cet ordre. Première qui échoue arrête le save. Sur `POST` (création), tous les champs NOT NULL sont requis dans le payload. Sur `PATCH` (update), les règles ne s'appliquent qu'aux champs présents dans le payload, et les règles de cohérence inter-champs (point 3, point 4) sont évaluées sur l'état mergé `(stored ∪ payload)`.

1. `slug` format `^[a-z0-9-]+$`, non vide, unique (à la création).
2. `width`/`height` entiers dans `[1, 10000]`.
3. `image_aspect_ratio` : si `image_prompt` non vide, doit appartenir à `GeminiAspectRatio`. Si `image_prompt` vide, doit être null.
4. `variables_schema` : parse JSON valide → Ajv compile sur draft 2020-12 → chaque propriété a une `description` non vide → chaque `x-source` est dans `{ai, user, image}` → cohérence : si une variable a `x-source: "image"`, alors `image_prompt` doit être non vide.
5. `sample_vars` : parse JSON valide → conforme au `variables_schema` (Ajv validate).
6. `body_html` : Handlebars compile sans erreur (dry-run).
7. `css` : ne contient pas `<` ni `</style>` (sanity check pour éviter de casser le doc).
8. **Preview obligatoire** : `compileTemplate` + `renderHtmlToPng` avec `sample_vars` doit produire un PNG sans erreur. Si KO, save refusé avec message d'erreur.

Coût du preview ~600-1200ms par save. Acceptable côté admin. Garantit qu'on ne stocke jamais un template cassé (cohérent avec le choix "single version save direct").

### Suppression bloquée si références

```sql
SELECT COUNT(*) FROM visuals WHERE template_slug = ?
```

Si > 0, la suppression est refusée et l'UI affiche le compteur ("12 visuels utilisent ce template"). L'admin doit supprimer ou re-attribuer les visuels avant de supprimer le template. Justification : plus simple que d'introduire un champ `archived`, et ça force la réflexion.

## Migration des 10 templates existants

Stratégie : seed manuel + golden image testing.

### Étapes

1. **Snapshot avant migration** : pour chaque template, rendre un PNG de référence avec des `sample_vars` figés. Stockés dans `tests/golden/visual-templates/<slug>.png`. Vérité absolue : ce qui sort du nouveau pipeline doit pixel-match (tolérance < 0.1%, soit ~1 pixel sur 1000).

2. **Traduction TS → Handlebars**, un template à la fois :
   - Le script `scripts/migrate-visuals.ts` (aide manuelle) appelle l'ancien `render()` avec des placeholders sentinels (`__SLUG_TITLE__`, `__SLUG_BULLETS_0__`) au lieu de vraies valeurs, capture l'HTML, sépare le `<style>` du `<body>`.
   - On remplace les sentinels par des handlebars (`{{title}}`, `{{#each bullets}}{{this}}{{/each}}`) à la main.
   - On transpose les conditionnels (`subtitle ? ... : ''` → `{{#if subtitle}}...{{/if}}`) à la main.
   - On extrait le schema TS en JSON Schema (à la main, ~10 templates × 4-6 variables = trivial).

3. **Extraction `base_css`** : les `@font-face` + reset universel + dimensions `html, body` se retrouvent dans tous les templates. On les sort dans `src/visuals/base.css`.

4. **Seed idempotent** : script `scripts/seed-visual-templates.ts` lit des fichiers seed (`src/visuals/seeds/<slug>/{body.hbs,style.css,schema.json,meta.json,sample-vars.json}`) et fait `INSERT OR IGNORE INTO visual_templates`. Lancé au premier boot post-migration et après chaque ajout de seed. `INSERT OR IGNORE` = first-write-wins : une fois la première migration faite, les templates édités à la main en DB ne sont jamais ré-écrasés. Flag `--force` sur le script pour re-seed volontaire.

5. **Golden tests** (`tests/visuals/golden/<slug>.test.ts`) : un test par template, compile + render + pixelmatch contre le golden PNG. Diff sauvegardé en `<slug>.diff.png` si échec.

6. **Suppression de `src/visuals/<slug>/index.ts`** une fois golden tests passants. Reste `src/visuals/{compile,types,index,base.css,seeds/*}.ts`. `src/visuals/index.ts` devient un loader DB exposant `getVisualTemplate(slug)` et `listVisualTemplates(platform?)`.

### Ordre de migration

Du plus simple au plus complexe :

1. `mock` (template de test, pas en prod) — valide le pipeline complet sur un cas trivial.
2. `linkedin-big-number` (pas d'image IA, peu de variables) — valide les conditionnels.
3. `linkedin-feature-image` (image IA simple) — valide l'injection image.
4. Les 7 autres dans n'importe quel ordre.

### Coût en git

10 PNGs golden × ~500KB-1.5MB = 5-15MB binaires en git. Acceptable. Si ça pose problème plus tard, on bascule sur Git LFS pour ce dossier.

### Rollback

Migration sur feature branch `templates-en-db`. Feature flag `VISUAL_TEMPLATES_FROM_DB` (env var, défaut `false` au début) permet de tester côté DB sans casser la prod. Au boot :

```ts
const fromDb = process.env.VISUAL_TEMPLATES_FROM_DB === 'true';
const getTemplate = fromDb ? getTemplateFromDb : getTemplateFromCode;
```

Flag flippé à `true` quand tous les golden tests passent. Une fois mergé et déployé stable, le flag et le code legacy sont supprimés dans un PR séparé.

## Tests, perf, dépendances

### Dépendances ajoutées

- `handlebars` (runtime, ~50KB minifié)
- `ajv` + `ajv-formats` (runtime, ~200KB)
- `pixelmatch` + `pngjs` (devDep, ~50KB combinés)

Toutes ESM Node-native, compatibles avec la philosophie "zero build, tsx".

### Tests

Trois niveaux, runner `node --test` natif (Node 22) via `tsx --test`.

1. **Unit (`tests/visuals/compile.test.ts`)** : compilateur sans Puppeteer. Cas : variable required manquante, JSON Schema invalide, helpers, source-routing `ai`/`user`/`image`, exposition `brand.*`, échappement double vs triple-stash.
2. **Integration (`tests/visuals/render.test.ts`)** : compile + renderHtmlToPng, image placeholder mockée, sans Gemini. Vérifie PNG produit, dimensions correctes.
3. **Golden (`tests/visuals/golden/<slug>.test.ts`)** : un par template, pixelmatch tolérance 0.1%.

Commande : `npm test` → `tsx --test tests/**/*.test.ts`. Ajout dans `package.json`. Pas de CI pour l'instant (hors scope).

### Performance

- Compilation Handlebars : 1-5ms par template, cachée par `slug:updated_at` (LRU 50). Coût amorti.
- Validation Ajv au save : 5-10ms, négligeable.
- Preview au save : 600-1200ms (Puppeteer). Acceptable côté admin.
- Génération normale (pipeline complet) : impact non mesurable (Sonnet + Gemini dominent).

### Observabilité

Logs JSON structurés via `console.log` aux points clés (compile, save, fail) :

```
{"evt":"template_compile_fail","slug":"linkedin-big-number","err":"Missing required: title"}
{"evt":"template_save_ok","slug":"linkedin-big-number","preview_ms":847}
```

Suffisant pour debug local. Pino + transport viendra avec chantier (1) backend.

## Estimation

- Modèle de données + table + types : 1-2h
- Compilateur Handlebars + helpers + cache : 2-3h
- Pipeline integration (`produceVisual`, `regenerateImageOnly`) : 1-2h
- Routes CRUD `/visual-templates` + validation : 2-3h
- UI éditeur (parité minimale) : 3-4h
- Migration des 10 templates + golden tests + seed : 4-6h
- Cleanup + flag flip + suppression legacy : 1h

Total : 14-21h. Couvrable en deux sessions. Découpage suggéré :
- Session 1 (nuit) : fondation (modèle, compilateur, pipeline, un template migré, UI minimale). Feature flag en place, code legacy intact.
- Session 2 : 9 templates restants, golden tests complets, polish UI, flip du flag, cleanup.

## Hors scope (pour mémoire)

Repris dans les chantiers suivants :

- Multi-tenant : templates restent system-wide.
- Versioning historique : single version save direct.
- Templates user-created : admin-only.
- Éditeur visuel du JSON Schema : textarea brute pour l'instant.
- Sandboxing du rendu Puppeteer : full trust admin.
- Asset store séparé pour SVG/logos : SVGs inline dans `body_html`, brand assets via `settings.*`.
- Migration vers Postgres : SQLite reste, schema compatible.
