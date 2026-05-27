# Spec 16 — Refonte UX « Ajouter un visuel »

## Objectif

Refondre l'expérience d'ajout de visuel autour de composants partagés, dans deux contextes : la modale « Ajouter un visuel » d'un post, et la galerie média. Supprimer la modale-dans-modale, donner de la place, et afficher une grille de templates avec un rendu HTML réel.

## Contexte et problèmes actuels

- Modale « Ajouter un visuel » (`add-visual-dialog.tsx`, `max-w-3xl`) avec 5 modes, qui ouvre une **seconde** modale minuscule (`add-image-dialog.tsx`, `sm:max-w-sm`) pour le choix upload / génération IA.
- Le picker de templates est **textuel** : pas de miniature, on choisit à l'aveugle.
- La galerie réutilise la même petite modale upload/IA, peu pratique.

## Périmètre

Deux surfaces, des briques communes. Hors périmètre : la logique éditoriale des posts (backlog séparé), le pipeline de rendu/queue (réutilisé tel quel).

## Architecture

### Briques réutilisables

Composants écrits une fois, utilisés dans les deux surfaces :

- **TemplatePicker** — grille de miniatures, rendu HTML de chaque template avec son contenu d'exemple (`sampleVars`), lazy-load au scroll, zoom grand format.
- **GenerateComposer** — composeur de génération d'image IA, layout deux panneaux.
- **UploadDropzone** — zone d'import de fichier (image ou vidéo).
- **MediaPicker** — sélection dans la galerie existante (mono ou multi-sélection).

### Surface 1 — Modale « Ajouter un visuel » (post)

Grande modale (`max-w-5xl`, hauteur ample). **Rail vertical à gauche = type de visuel** (ce que LinkedIn accepte) :

- **Image** — segments en haut de la zone de contenu : `Templates · Galerie · Générer IA · Upload`.
  - *Templates* → TemplatePicker (vignettes = contenu d'exemple du template). Clic sur la vignette = sélection ; clic sur l'icône zoom (⤢) = overlay grand format. Après sélection, le `VariablesForm` existant permet de saisir le contenu réel avec un grand aperçu live, puis « Valider et attacher » (`enqueuePostFinalAction`).
  - *Galerie* → MediaPicker mono-sélection → `attachExistingMediaAction`.
  - *Générer IA* → GenerateComposer embarqué ; bouton « Attacher au post ».
  - *Upload* → UploadDropzone (image) → upload puis attache au post.
- **Carrousel** — MediaPicker multi-sélection + ordonnancement des slides → `createCarouselAction` (logique existante réorganisée).
- **Vidéo** — UploadDropzone (vidéo) → `uploadVideoAction`.

Ouverture par défaut sur **Image › Templates**.

### Surface 2 — Galerie (page média)

Deux boutons en haut à droite :

- **« ↑ Importer »** → file picker natif direct → `uploadImageAction`.
- **« ✨ Générer une image »** → ouvre le GenerateComposer en grande modale → `enqueueGenerateImageAction` (sans `postId`).

Le `gallery-add-button.tsx` actuel (petite modale) est remplacé par ces deux boutons.

### GenerateComposer (détail)

Layout deux panneaux :

- **Gauche** : prompt (textarea), sélecteur de style (visual styles de l'utilisateur), format (chips d'aspect ratio), bouton « Générer ».
- **Droite** : grand aperçu du dernier rendu + **historique des essais de la session** (état React local, non persisté). Bouton « Ajouter à la galerie » ; « Attacher au post » quand embarqué dans la modale post.

Seules les images explicitement ajoutées par l'utilisateur sont persistées (via les actions existantes). L'historique de session disparaît à la fermeture.

## Approche technique des miniatures

Réutilise l'aperçu HTML existant (`template-preview.tsx` + `buildPreviewHtml` de `src/lib/visual-templates/preview.ts`) :

- `buildPreviewHtml` est **server-only** (lit `base.css` via `node:fs`, compile en Handlebars). Le HTML de chaque template est donc **construit côté serveur** dans la page post (Server Component), à partir des `sampleVars` du template + le brand de l'utilisateur, et passé au client sous forme de `{ templateId, html, width, height }[]`.
- Le client rend une **iframe scalée par template** (`srcDoc` = HTML pré-construit), **lazy-loadée au scroll** via IntersectionObserver : on ne monte l'iframe que lorsque la vignette entre dans le viewport.
- Rendu à basse résolution (transform scale).

Pas de pré-rendu PNG ni de cache d'images : le HTML est compilé à la volée côté serveur au chargement de page, l'iframe reste légère et le lazy-load borne le coût même avec beaucoup de templates.

## Décisions arrêtées

- Conteneur post = grande modale (pas de page dédiée).
- Organisation = rail par type, puis segments par source.
- Miniatures templates = rendu du contenu d'exemple (`sampleVars`) ; le contenu réel se saisit à l'étape d'édition après sélection.
- GenerateComposer = deux panneaux avec historique de session.
- Zoom template = icône ⤢ → overlay ; clic vignette = sélection.
- Historique de génération = par session, non persisté.

## Composants à créer / modifier

Création :
- `TemplatePicker` (grille + miniatures lazy-loadées + zoom).
- `GenerateComposer` (deux panneaux + historique session).
- `UploadDropzone`.
- `MediaPicker` (mono + multi).

Modification :
- `add-visual-dialog.tsx` → grande modale avec rail par type + segments, assemblant les briques.
- `media/page.tsx` + remplacement de `gallery-add-button.tsx` → deux boutons.
- Suppression de `components/media/add-image-dialog.tsx` (la petite modale) une fois ses usages remplacés.

Réutilisés tels quels : actions serveur (`media-actions.ts`, `media/actions.ts`), queues render-visual et generate-image, `template-preview.tsx`, `buildPreviewHtml`.

## Tests

- Unitaire/intégration : actions serveur déjà couvertes ; pas de nouvelle logique serveur.
- E2E Playwright (stubs) :
  - Galerie : « Importer » ajoute une image ; « Générer » ouvre le composeur, génère (stub), ajoute à la galerie.
  - Post : ouvrir la modale, choisir un template dans la grille → visuel attaché ; générer IA → attaché ; carrousel multi-sélection → créé.
- Rendu des miniatures : vérifier qu'au moins une iframe de template se monte au scroll.

## Risques

- Performance des iframes multiples : mitigée par lazy-load + basse résolution. À surveiller si le nombre de templates explose.
- Coût de compilation serveur de N templates au chargement de la page post : acceptable (compile en mémoire, pas de Puppeteer). À surveiller si le nombre de templates explose.
