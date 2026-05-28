# Spec 13 — Import templates V1 + preview HTML live — Design

**Objectif** : rapatrier les 9 templates visuels restants de la v1 dans la nouvelle structure (optimisés, cohérents, prêts à l'emploi), et afficher une **prévisualisation HTML live** des templates (sans passer par un rendu image).

## Contexte

La v1 (`/Users/ManuAVQN/Code/content-os/src/visuals/*/index.ts`) a 11 templates. v2 en a déjà 3 (`linkedin-big-number`, `linkedin-manifesto`, `linkedin-photo-card`). Restent à porter : **banner-stat, code-window, command, feature-image, horizontal, poster, process, stack, vertical**.

Obstacle : 6 d'entre eux utilisent des types de variables que le DSL v2 ne connaît pas — `list` (code-window, command, process, stack) et `color` (banner-stat, poster). Le DSL v2 ne gère que `string` et `image`.

## Périmètre

1. **Étendre le DSL v2** : ajouter `list` (tableau de strings) et `color` (hex, user-driven, valeur par défaut).
2. **Normaliser le contexte de rendu** : Handlebars compile en `strict: true` → toute variable du schéma doit exister dans le contexte. Remplir les défauts (string→'', list→[], color→default, image→placeholder/url) avant compilation, côté worker **et** preview.
3. **Porter les 9 templates** en seeds v2 (Handlebars `bodyHtml` + `css` + schéma DSL + `sampleVars`), en préservant/optimisant le design v1.
4. **Preview HTML live** : compiler un template en HTML (Handlebars + CSS, placeholders d'image) sans Puppeteer, l'afficher dans une iframe à l'échelle. Composant réutilisable. Affiché sur la page détail d'un template (aperçu immédiat avec `sampleVars`).

Hors périmètre : éditeur live des champs avec re-render à chaque frappe (le composant le permettra techniquement, mais le câblage « édition live partout » est suffisant via la page détail + sample_vars). Migration des visuels générés v1.

## DSL étendu — `src/lib/visual-templates/dsl.ts`

- `listSpec` : `{ type: 'list', name, label, description?, itemMin?, itemMax?, minItems?, maxItems?, optional? }`. Valeur = `string[]`.
- `colorSpec` : `{ type: 'color', name, label, description?, default?, optional? }`. Valeur = string hex `#RRGGBB`. User-driven (jamais rempli par l'IA, exclu du remplissage auto).
- `variableSpecSchema` = discriminatedUnion('type', [string, image, list, color]).
- `variablesSchemaToZod` :
  - `list` → `z.array(z.string())` avec `min/max` items et contraintes item (best-effort) ; optional respecté.
  - `color` → `z.string().regex(/^#([0-9a-fA-F]{6})$/)` ; toujours optionnel à la validation (valeur par défaut injectée au rendu).
- Nouveau `fillVarDefaults(schema, vars)` → renvoie un contexte complet (toutes les clés présentes) : string→`''`, list→`[]`, color→`default ?? '#000000'`, image→inchangé. Utilisé avant `compileTemplate`.

## Rendu / preview

- `src/lib/visual-templates/preview.ts` : `buildPreviewHtml(template, vars, brand?)` → applique `fillVarDefaults`, injecte un placeholder pour les vars image, appelle `compileTemplate`. Server-only (fs + Handlebars).
- Worker `render-visual` : utilise `fillVarDefaults` pour bâtir le contexte (corrige les optionnels absents en strict mode).
- UI : composant client `TemplatePreview` (iframe `srcDoc` du HTML, `transform: scale` pour tenir dans le conteneur en respectant le ratio). Sur `/settings/visual-templates/[id]`, aperçu live immédiat avec `sampleVars` (le HTML est compilé côté serveur et passé au composant). Le bouton « Prévisualiser » (rendu image Puppeteer) reste disponible pour valider le vrai PNG.

## Variables (formulaires)

Les formulaires de variables (`variables-form` côté post, et l'édition de template) gèrent les nouveaux types : `list` → liste d'inputs ajoutables/supprimables ; `color` → `<input type="color">` (défaut = `spec.default`). Les types existants inchangés.

## Tests

- **Unit DSL** : `list` (array, minItems/maxItems, optional), `color` (regex hex, défaut), `fillVarDefaults` (remplit chaque type), schéma mixte parsé.
- **Integration** : chaque template seedé compile sans erreur (Handlebars strict) avec ses `sampleVars` → HTML non vide ; `fillVarDefaults` permet la compilation même avec optionnels absents.
- **Vérification visuelle réelle** : rendu PNG (Puppeteer) de chaque template porté → inspection de l'image (cohérence, pas de débordement).
- **E2E** : la page détail d'un template affiche l'aperçu live (iframe présente).

## Cohérence visuelle

Palette noir/blanc brutaliste AVQN (déjà la base), fonts Clash Display + General Sans (base.css). Harmoniser paddings/échelles entre templates, garde-fous d'overflow (`max-height`/`overflow:hidden`) repris de la v1. `sampleVars` réalistes et cohérents (univers AVQN : automatisation IA, fondateur solo).
