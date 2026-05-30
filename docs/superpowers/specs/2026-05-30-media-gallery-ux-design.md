# Refonte UX — Galerie média

Date : 2026-05-30
Branche : `claude/vibrant-mayer-b6uK6`

## Problème

La galerie média (`/media/gallery`) mélange deux choses dans une même page :

1. un gros panneau de création en haut (onglets *Générer IA* / *Importer*) ;
2. la grille des médias avec un filtre `Tous / image / video / pdf / render` (libellés
   bruts en anglais) et un bouton « Assembler un PDF » planqué dans la grille qui
   bascule un mode sélection peu lisible.

Conséquences : on ne comprend pas bien « quoi est quoi » ni « comment faire ». Le type
`render` est déroutant — un render est techniquement une **image** ; sa nature réelle,
c'est sa **provenance** (généré IA, depuis un template, importé, assemblé…), déjà
encodée dans la colonne `media.source`.

## Objectifs

1. **Cliquer « Galerie » → voir directement tous les éléments.** Plus de gros panneau de
   création en tête de page.
2. **Filtre clair en français : Tous / Images / Vidéos / PDF.** Plus de filtre `render`.
3. **Un bouton « Ajouter un élément à la galerie »** qui ouvre un **lanceur** (modale)
   proposant 4 modes de création. Chaque mode **dépose dans une sous-partie de création
   dédiée**, avec un **retour intelligent** vers la galerie.
4. **Supprimer le `kind` `render`** : un render devient une `image`. La provenance
   (déduite de `source`) s'affiche en **badge** sur chaque vignette.

## Décisions (brainstorming validé)

- **Render → image + badge de provenance.** On retire `'render'` de `MediaKind`. Badge
  déduit de `source` : Généré (IA) / Édité (IA) / Depuis un template / Rendu HTML /
  Importé / Assemblé. Migration des lignes `kind='render'` existantes → `'image'`.
- **Lanceur = modale sur la galerie**, mais ce n'est **pas** un formulaire enfermé :
  c'est un sélecteur qui **redirige vers la sous-partie de création correspondante**.
- **4 modes** : Générer (IA), Importer (image/vidéo/PDF unifié), Depuis un template,
  Assembler un PDF.
- **« Depuis un template » renvoie vers l'onglet Templates** existant (pas de duplication
  de l'UI de rendu).
- **Retour intelligent** : après une création réussie, on **reste** sur la page de
  création et une **bannière de succès** s'affiche en haut : « ✓ Média ajouté à la
  galerie — [Voir la galerie] · [Continuer ici] ». Un lien « ← Galerie » est toujours
  présent en haut de chaque page de création.

## Architecture

### Modèle de données

- `MediaKind` = `'image' | 'video' | 'pdf'` (retrait de `'render'`) dans
  `src/lib/media/types.ts`.
- Producteurs qui stockaient `kind: 'render'` → `kind: 'image'` (la `source` est
  inchangée et porte la provenance) :
  - `src/lib/media/templates/render.ts` (source `template_render`) ;
  - `src/lib/mcp/tools/media-engine.ts`, outil `render_html` (source `html_render`).
- Enum `kind` de l'outil MCP (`media-engine.ts`) : retrait de `'render'`.
- `media-ref.ts` : commentaire mis à jour (le `return 'image'` couvrait déjà
  image|render — aucun changement de comportement).
- **Migration de données** (custom drizzle) :
  `UPDATE media SET kind = 'image' WHERE kind = 'render';`

### Provenance (nouveau module pur, testé)

`src/lib/media/provenance.ts` :

```ts
export function provenanceLabel(source: MediaSource): string
// gemini_generate → 'Généré (IA)'
// gemini_edit     → 'Édité (IA)'
// template_render → 'Depuis un template'
// html_render     → 'Rendu HTML'
// upload          → 'Importé'
// pdf_aggregate   → 'Assemblé'
```

### Filtres galerie (nouveau module pur, testé)

`src/lib/media/gallery-filters.ts` : liste ordonnée `{ kind, label }` en français
(Images / Vidéos / PDF), sans `render`. Consommée par `gallery/page.tsx`.

### Modes de création (nouveau module pur, testé)

`src/lib/media/creation-modes.ts` : config `{ id, label, description, href,
requiresGemini }` pour Générer / Importer / Depuis un template / Assembler. Consommée par
le lanceur. Garde le composant mince et testable.

### Page galerie

`src/app/(app)/media/gallery/page.tsx` :
- retire `<CreatePanel>` ;
- header : titre + bouton **« Ajouter un élément »** (ouvre la modale `AddMediaLauncher`) ;
- filtres FR depuis `gallery-filters` ;
- `GalleryGrid` : grille + **badge de provenance** par vignette + agrandir/éditer/
  supprimer. On **retire** le mode sélection « Assembler un PDF » de la grille (déplacé
  vers la page `/assemble`). `isRaster` → `kind === 'image'`.

`AddMediaLauncher` (client) : bouton + `Dialog` listant les 4 modes (cartes cliquables
qui naviguent). Générer grisé + indice si Gemini indisponible.

### Sous-pages de création (sous `/media/gallery/`)

Chacune : lien « ← Galerie » en haut, titre, formulaire (réutilise les server actions
existantes), et **bannière de succès** réutilisable après création.

- `generate/page.tsx` (+ `generate-form.tsx`) — réutilise la logique de `GenerateForm`
  (prompt, ratio, style), `generateAction`.
- `import/page.tsx` (+ `import-form.tsx`) — réutilise `UploadForm`, `uploadAction`.
- `assemble/page.tsx` (+ `assemble-picker.tsx`) — liste les médias `image`, sélection
  ordonnée, `aggregatePdfAction`.

Composant partagé `creation-feedback.tsx` (client) : bannière « ✓ Média ajouté à la
galerie — [Voir la galerie] · [Continuer ici] » + helper du lien retour.

`CreatePanel` (`create-panel.tsx`) est démantelé ; sa logique de formulaire migre dans
`generate-form.tsx` / `import-form.tsx`.

### Templates = destination « Depuis un template »

`templates/[id]/template-preview.tsx` : après un rendu réussi, afficher la même bannière
de succès (Voir la galerie · Continuer ici) pour la cohérence. Changement minimal.

## Tests (TDD, vitest, `test/lib/media/`)

1. `provenance.test.ts` — un libellé attendu par `source`.
2. `gallery-filters.test.ts` — ordre, libellés FR, absence de `render`.
3. `creation-modes.test.ts` — 4 modes, hrefs corrects, `requiresGemini` sur Générer.
4. Tests existants (`media-ref`, `tags`, `validate-upload`) restent verts.

UI : vérification visuelle via `/apercu` (mobile + desktop) sur la galerie et les
sous-pages avant push.

## Hors périmètre

- Pas de refonte des sections Styles / Chartes / Marque.
- Pas d'exposition UI du champ `tags` libre (réservé à plus tard).
- Pas de changement du moteur de rendu / Gemini / R2.
