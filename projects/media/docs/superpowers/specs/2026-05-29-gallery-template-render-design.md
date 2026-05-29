# Spec — Onglet « Template » dans la modal galerie

**Date** : 2026-05-29
**Projet** : media
**Rail** : /lab-ship

## Intention

Dans la modal « Ajouter à la galerie » (`/gallery/new`), ajouter un quatrième
onglet **Template** permettant de **rendre une image à partir d'un template**
existant de la bibliothèque, sans passer par la page `/templates`.

Parcours :
1. L'utilisateur voit la **liste des templates** (cartes).
2. Il en **choisit un** → le formulaire de ses variables se remplit (valeurs
   d'exemple `sampleVars` par défaut).
3. Il **édite le formulaire** ; un **aperçu HTML live** se met à jour à côté.
4. Il clique **« Ajouter à la galerie »** → rendu image (Chromium) + stockage,
   la modal se ferme, l'image apparaît dans la galerie.

## Décisions de cadrage (validées avec Manu)

- **Aperçu live = rendu HTML dans une `<iframe>`**, pas un rendu image Chromium.
  Instantané, sans coût browserless. Le rendu Chromium (coûteux) n'a lieu qu'au
  clic final « Ajouter à la galerie ».
- **Variables `image`** : renseignées via un **sélecteur dans la galerie**
  (médias déjà chargés côté page). La valeur stockée est l'**URL** du média
  (cohérent avec le rendu : `background-image:url('{{image}}')` dans les
  templates ; rien ne résout un mediaId).
- **Composants réutilisables** : l'aperçu live et le formulaire dynamique sont
  écrits comme des composants autonomes, réutilisables ailleurs (ex. éditeur de
  templates) sans dépendre de la modal.

## Architecture existante réutilisée

- `compileTemplate({ template, vars, brand })` (`src/lib/templates/compile.ts`)
  — Handlebars (strict) + `brand`, renvoie le HTML complet (`<!doctype html>…`).
- `getBrandContext(userId)` (`src/lib/brand/repository.ts`) → `Brand`.
- `parseVariablesSchema` / `fillVarDefaults` (`src/lib/templates/dsl.ts`).
- `renderTemplate(userId, templateId, vars, { imagesOptional })`
  (`src/lib/templates/render.ts`) — compile → `renderHtml` (Chromium) → `store`
  (`kind: "render"`, `source: "template_render"`, `template_id`, `vars`).
- `listTemplates(userId)` (`src/lib/templates/repository.ts`).
- Modal : `add-media-dialog.tsx` (client, onglets via `<Link ?tab=>`),
  `tabs.ts`, `page.tsx` (server, charge styles + images, force-dynamic).

## Surface à modifier / créer

- `tabs.ts` : ajouter `"template"` à `TABS`.
- `add-media-dialog.tsx` : `TAB_LABELS.template`, nouvelle prop `templates`,
  rendu de l'onglet `<TemplateTab>`. On étend le composant existant — pas de
  wrapper en double. Conserver le thème clair existant (cohérence visuelle).
- `page.tsx` : charger `listTemplates(userId)` et passer `templates` au dialog.
  Passer aussi la liste des médias image (URL) pour le sélecteur d'images.
- `actions.ts` (gallery) :
  - `previewTemplateHtmlAction(templateId, vars)` → `{ html }` : compile le
    HTML (vars + marque) **sans** Chromium ni `store`. Tolérant (remplit les
    variables manquantes par défaut, ne valide pas un formulaire en cours).
  - `renderTemplateFromTemplateAction(templateId, vars)` →
    `{ ok, url } | { error }` : `renderTemplate(..., { imagesOptional: true })`
    + `revalidatePath("/gallery")`.
- Nouveaux composants (dossier `gallery/new/`) :
  - `template-tab.tsx` : orchestration (grille de cartes ↔ formulaire + aperçu).
  - `template-vars-form.tsx` : formulaire dynamique depuis `VariablesSchema`
    (string / list / color / image→sélecteur galerie). **Réutilisable.**
  - `template-live-preview.tsx` : `<iframe sandbox srcDoc>` aux dimensions
    natives, mise à l'échelle (`transform: scale`) pour tenir dans le panneau ;
    debounce du HTML. **Réutilisable.**

`compile.ts` / `render.ts` réutilisés tels quels. Pas de changement de schéma DB.

## Hors scope

- L'éditeur `/templates/[id]` existant n'est pas modifié (son aperçu Chromium
  au bouton reste tel quel). Les nouveaux composants sont juste prêts à y être
  réutilisés plus tard.
- Pas de nouvelle variable de type. Pas de changement d'API `/v1` ni MCP.

## Critères d'acceptation

- Un 4ᵉ onglet « Template » apparaît dans la modal `/gallery/new`.
- L'onglet liste les templates de l'utilisateur ; cliquer une carte ouvre le
  formulaire pré-rempli avec `sampleVars`.
- Le formulaire couvre les 4 types de variables ; les variables `image` se
  choisissent dans la galerie.
- L'aperçu HTML à côté se met à jour en live quand on édite le formulaire,
  sans appel Chromium.
- « Ajouter à la galerie » produit un média `kind: "render"` visible dans la
  galerie après fermeture ; les erreurs de rendu s'affichent dans l'onglet.
- `npm run typecheck`, `lint`, `build` et `test` passent.
