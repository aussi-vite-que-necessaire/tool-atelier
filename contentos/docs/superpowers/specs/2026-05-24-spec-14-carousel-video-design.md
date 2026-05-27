# Spec 14 — Carrousel LinkedIn (PDF) + upload vidéo — Design

**Objectif** : composer un carrousel LinkedIn (PDF de slides au même format) à partir d'images de la galerie et de rendus de templates, l'attacher à un post à la place d'une image, et le publier comme document. Bonus : uploader une vidéo MP4 dans un post et la publier.

## Contexte API (lu sur Microsoft Learn)

- **Carrousel swipeable LinkedIn = post Document (PDF)** (le multi-image natif organique n'existe plus). Upload via Documents API (`/rest/documents?action=initializeUpload` → PUT → statut `AVAILABLE`), puis post `content.media: {title, id: urn:li:document}`. Limites : ≤ 100 Mo, ≤ 300 pages.
- **Vidéo** : Videos API (`/rest/videos?action=initializeUpload` → upload **chunké 4 Mo** → `finalizeUpload` → poll statut `AVAILABLE`), puis post `content.media: {id: urn:li:video}`. MP4, 3 s–30 min, 75 Ko–500 Mo. Miniature auto.

## Modèle de données

`media.kind` (`image`|`carousel`|`video`) existe déjà.
- **Carrousel** : `media` kind `carousel`, `assetKey` = clé R2 du PDF, `previewKey` = clé de la 1ʳᵉ slide, `width`/`height` = format des slides.
- Nouvelle table **`carousel_slides`** : `id`, `mediaId` (FK cascade), `position` (int), `slideKey` (clé R2 de l'image). Slides ordonnées. Migration.
- **Vidéo** : `media` kind `video`, `assetKey` = clé R2 du MP4, `width`/`height` = 0 (inconnu, non utilisé).

## Slides : galerie + rendus de templates, **même format**

- Une slide est une **image** (clé R2). Sources : uploads, images IA, et **rendus de templates**.
- Contrainte **même format** : toutes les slides ont des dimensions identiques. Le **format se verrouille sur la 1ʳᵉ slide** ; le sélecteur ne propose ensuite que des images de mêmes `width`×`height`.
- **Rendre un template → galerie** : nouvelle option de sortie du rendu (en plus de « attacher au post »). Le worker `render-visual` accepte une destination `gallery` qui crée une image standalone (réutilisable comme slide). Permet de composer un deck depuis les 12 templates.

## Builder de carrousel

Dans l'ajout de visuel d'un post, nouveau mode **« Carrousel »** :
1. sélectionner ≥ 2 images de format identique (galerie filtrée par dimensions une fois la 1ʳᵉ choisie) ;
2. réordonner les slides ;
3. « Créer le carrousel » → Server Action `createCarouselCore(userId, { postId, slideKeys })` :
   - vérifie ≥ 2 slides, toutes de mêmes dimensions ;
   - télécharge les bytes des slides depuis R2 ;
   - **assemble le PDF** (`buildCarouselPdf`, `pdf-lib`, 1 image = 1 page, pages uniformes au format) ;
   - upload PDF sur R2, crée le `media` carrousel + lignes `carousel_slides`, attache au post.

### `src/lib/carousel/build-pdf.ts`
`buildCarouselPdf(slides: { bytes: Buffer; type: string }[], { width, height }): Promise<Buffer>` — pure, testable. Une page par image, taille = format. Embarque JPG/PNG via pdf-lib.

## Publication

`publish-core` snapshot étendu selon `media.kind` :
- image → `mediaKind='image'`, `snapshotKeys=[assetKey]` (existant).
- carrousel → `mediaKind='carousel'`, `snapshotKeys=[clé PDF]`.
- vidéo → `mediaKind='video'`, `snapshotKeys=[clé MP4]`.

`publish.ts` / worker `publish-linkedin` étendus :
- **carousel** : upload PDF via Documents API → poll `AVAILABLE` → `content.media: {title, id: urn:li:document}`.
- **video** : Videos API (init → chunks 4 Mo → finalize → poll `AVAILABLE`) → `content.media: {id: urn:li:video}`.
- image/texte : inchangé.
- Stub `CONTENT_OS_LINKEDIN_STUB=1` couvre carrousel et vidéo (faux URN, aucun réseau).

## Upload vidéo

Nouveau `uploadVideoCore(userId, file, { postId })` (parallèle à `uploadImageCore`) : valide MP4 + taille ≤ 500 Mo, upload R2, crée `media` kind `video`, attache au post. UI : l'ajout de visuel d'un post propose « Vidéo » → input fichier MP4.

## UI post

L'affichage du visuel d'un post gère 4 cas : image (existant), **carrousel** (aperçu des slides, navigation), **vidéo** (balise `<video>` avec URL signée), ou aucun. Détacher fonctionne pour tous.

## Tests

- **Unit** : `buildCarouselPdf` (PDF multi-pages valide, bon nombre de pages, en-tête `%PDF`) ; validation « même format » (rejet si dimensions hétérogènes) ; validation upload vidéo (type/taille).
- **Integration** : `createCarouselCore` (≥ 2 slides, crée media+slides, attache) ; `uploadVideoCore` ; `publish-core` snapshot carrousel/vidéo (mediaKind + snapshotKeys corrects) ; rendu template → galerie (image standalone créée).
- **Worker** : processor `publish-linkedin` avec stub → carrousel publié (document) et vidéo publiée, statut `published`.
- **E2E** (`CONTENT_OS_LINKEDIN_STUB=1`) : composer un carrousel de 2 images uploadées → attacher au post → publier (stub) → `published` ; uploader une vidéo → publier (stub).

## Dépendance

`pdf-lib` (pur JS, aucun binaire).

## Hors périmètre

Génération IA de vidéo ; édition de slides dans le PDF après coup ; réordonnancement post-création (on recrée le carrousel) ; sous-titres/miniature vidéo custom ; MultiImage collage.
