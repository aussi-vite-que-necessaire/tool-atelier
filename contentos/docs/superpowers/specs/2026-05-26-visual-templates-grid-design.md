# Grille d'aperçus pour les templates visuels

## Objectif

La liste des templates visuels (`/settings/visual-templates`) affiche une grille
de vignettes : chaque template est rendu en aperçu visuel, les vignettes sont
côte à côte, et cliquer sur une carte ouvre la page d'édition du template.

## Périmètre

Un seul fichier de page change : `src/app/(settings)/settings/visual-templates/page.tsx`,
plus un composant client dédié à la carte. L'éditeur de post n'est pas modifié.

## Comportement

- La page liste les templates de l'utilisateur dans une grille responsive
  (2 colonnes en mobile, 3 en `sm`, 4 en `lg`).
- Chaque carte montre une vignette d'aperçu du template (HTML+CSS compilé) au
  ratio du template, plus un pied de carte : `label` puis
  `platform · slug · width×height`.
- La carte entière est un lien vers `/settings/visual-templates/[id]` (page
  d'édition, qui contient déjà l'aperçu complet et le formulaire).
- Sans template : le message « Aucun template pour le moment. » reste affiché.

## Rendu de l'aperçu

L'aperçu réutilise `buildPreviewHtml(template, sampleVars, brand)`
(`src/lib/visual-templates/preview.ts`) : compilation Handlebars + CSS sans
Puppeteer, instantanée et côté serveur. Les variables image prennent leur
placeholder gris. `brand` provient des settings de l'utilisateur.

La vignette est une `<iframe sandbox srcDoc={html}>` mise à l'échelle pour tenir
dans la largeur de la cellule en respectant le ratio du template. Le rendu est
différé jusqu'à ce que la cellule entre dans le viewport (IntersectionObserver)
et l'échelle s'adapte à la largeur mesurée de la cellule (ResizeObserver) —
même technique que la vignette de l'éditeur de post
(`posts/[id]/_components/template-thumbnail.tsx`).

## Composants

- `page.tsx` (server component) : charge les templates et le brand des settings,
  mappe chaque template en view-model via une fonction pure
  `toTemplateCardData(templates, brand)` retournant
  `{ id, label, platform, slug, width, height, html }[]`, puis rend la grille.
- `_components/template-card.tsx` (client component, nouveau) : reçoit un
  view-model, rend le lien + la vignette à l'échelle + le pied de carte.

`toTemplateCardData` vit dans un module sans dépendance React (par ex.
`_components/template-card-data.ts`) pour être testable en unit sans navigateur.

## Tests

1. **Unit** (`test/unit/...`) : `toTemplateCardData` produit le bon view-model
   (id, label, platform, slug, width, height préservés) et un `html` non vide
   contenant le contenu rendu des `sampleVars` pour un template donné.
2. **E2E** (extension de `test/e2e/visual-templates.spec.ts`) : après création
   d'un template, la liste affiche une `<iframe>` d'aperçu pour ce template ;
   cliquer sur la carte mène à la page d'édition (assertion déjà présente,
   conservée).

## Déploiement

Une fois mergé sur `main`, déploiement prod sur contentos.avqn.ch selon la
procédure habituelle (Coolify).
