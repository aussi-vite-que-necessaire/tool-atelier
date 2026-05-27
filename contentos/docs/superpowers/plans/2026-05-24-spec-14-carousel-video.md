# Spec 14 — Carrousel PDF + upload vidéo — Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en `- [ ]`.

**Goal:** Carrousel (PDF de slides même format, galerie + templates) attaché à un post + publié comme document ; upload vidéo MP4 + publié. Stub LinkedIn pour CI/E2E.

---

## Task 1 : dep pdf-lib + buildCarouselPdf (unit)
- `npm i pdf-lib`. Create `src/lib/carousel/build-pdf.ts` ; Test `test/unit/build-pdf.test.ts`.
- [ ] `buildCarouselPdf(slides: { bytes: Buffer; type: string }[], size: { width: number; height: number }): Promise<Buffer>` — pdf-lib, 1 page/image au format `size`, embed PNG (`embedPng`) ou JPG (`embedJpg`) selon `type`, image dessinée plein cadre. Lève si 0 slide.
- [ ] Unit : 2 PNG 10×10 → PDF commence par `%PDF`, `PDFDocument.load` → 2 pages, dimensions de page = size. `npm run test:unit -- build-pdf`.
- [ ] Commit.

## Task 2 : table carousel_slides + repo carrousel
- Create `src/lib/db/schemas/carousel-slides.ts`, `src/lib/db/repositories/carousels.ts` ; Modify `schema.ts`, `test/setup-integration.ts`. Migration `db:generate`.
- [ ] Table `carousel_slides` (id, mediaId FK cascade, position int, slideKey text), index mediaId.
- [ ] Repo : `createCarousel(userId, { assetKey, previewKey, width, height, slideKeys })` → crée `media` kind carousel + N `carousel_slides` (transaction), renvoie media ; `getCarouselSlides(mediaId)` → slides ordonnées.
- [ ] cleanup test setup (delete carouselSlides avant media). Migrate dev + test. Commit.

## Task 3 : createCarouselCore (integration)
- Create `src/lib/carousel/carousel-core.ts` ; Test `test/integration/carousel-core.test.ts`.
- [ ] `createCarouselCore(userId, { postId, slideKeys })` : charge les `media` image correspondant aux slideKeys (via une requête par assetKey), vérifie ≥ 2 et **dimensions identiques** (sinon erreur), download bytes R2, `buildCarouselPdf`, upload PDF (`media/${userId}/${id}.pdf`), `createCarousel(...)`, `updatePost(mediaId)`. Renvoie `{ mediaId }` ou erreur.
- [ ] Helper repo `listImageMediaByDimensions(userId, width, height)` + `getMediaByAssetKeys` (pour résoudre slides).
- [ ] Integration (storage InMemory) : 2 images mêmes dims → carrousel créé (kind carousel, slides=2, post.mediaId set) ; dims différentes → erreur ; < 2 → erreur.
- [ ] Commit.

## Task 4 : uploadVideoCore (integration)
- Modify `src/lib/media/validate-upload.ts` (accepter `video/mp4`, limite 500 Mo) ; Create `src/lib/media/upload-video-core.ts` ; Test `test/integration/upload-video.test.ts`.
- [ ] `validateVideoFile({type,size})` (mp4 only, ≤ 500 Mo) ; `uploadVideoCore(userId, file, {postId})` → upload R2, `createMedia` kind video (width/height 0), attache post.
- [ ] Integration : mp4 valide → media video + post attaché ; type non-mp4 → erreur ; trop gros → erreur. Commit.

## Task 5 : rendu template → galerie + sélecteur slides
- Modify `src/lib/queue/client.ts` (RenderVisualJob: `destination?: 'post' | 'gallery'`), `src/worker/queues/render-visual.ts` (si destination gallery → image standalone, pas d'attache post), enqueue/actions.
- [ ] Worker : mode final + destination `gallery` → crée media image (source standalone) sans `updatePost`. Défaut `post` (rétrocompat).
- [ ] Integration worker : render destination gallery → image standalone listée. Commit.

## Task 6 : publish.ts document + vidéo
- Modify `src/lib/linkedin/publish.ts`, `src/lib/publications/publish-core.ts`, `src/worker/queues/publish-linkedin.ts`. Tests unit + worker.
- [ ] `publish.ts` : `PublishOpts.media?: { kind: 'image'|'document'|'video'; bytes: Buffer; filename?: string }` (remplace `imageBytes`). `publishReal` dispatch :
  - image → init `/rest/images` → PUT → `content.media {id}`.
  - document → init `/rest/documents` → PUT → **poll GET `/rest/documents/{urn}` jusqu'à AVAILABLE** → `content.media {title, id}`.
  - video → init `/rest/videos` (fileSizeBytes) → PUT chunks 4 Mo (ETags) → `finalizeUpload` → **poll GET `/rest/videos/{urn}` AVAILABLE** → `content.media {id}`.
  - sans media → texte.
  - `buildPostBody` : `content.media {id, title?}` commun. Helpers `pollUntilAvailable(url, token, timeout)`.
- [ ] `publishStub` : renvoie faux URN quel que soit le média.
- [ ] `publish-core` : `buildSnapshot` pose `mediaKind` + `snapshotKeys` selon `media.kind` (image=assetKey, carousel=assetKey PDF, video=assetKey MP4).
- [ ] worker `publish-linkedin` : selon `pub.mediaKind`, download `snapshotKeys[0]`, mappe vers `media.kind` publish (`carousel→document`, `video→video`, `image→image`), passe bytes + filename.
- [ ] Unit : `buildPostBody` document/video ; `classifyHttpError` inchangé. Worker : stub → carrousel & vidéo `published`. Commit.

## Task 7 : UI (builder carrousel + upload vidéo + affichage)
- Modify `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx`, `visual-display.tsx`, actions média ; Create un composant builder.
- [ ] add-visual : modes `image` (existant) / `carrousel` / `vidéo`. Carrousel : grille de la galerie filtrée par dimensions (verrou sur 1ʳᵉ sélection), réordonnancement, bouton « Créer le carrousel » → action `createCarouselAction`. Vidéo : input file mp4 → `uploadVideoAction`.
- [ ] `visual-display` : carrousel → aperçu slides (URLs signées, navigation simple) ; vidéo → `<video controls src=signedUrl>`.
- [ ] Server actions `createCarouselAction`, `uploadVideoAction`, signer les URLs slides/vidéo dans la page post. Build OK. Commit.

## Task 8 : E2E
- Create `test/e2e/carousel-video.spec.ts`.
- [ ] Stub LinkedIn : signup → connecter LinkedIn (stub) → créer post → uploader 2 images même format → mode carrousel → créer → publier maintenant → `Publié`. Puis (autre post) uploader vidéo mp4 (petit fichier fixture) → publier → `Publié`.
- [ ] `pkill` workers avant run. Commit.

## Task 9 : Validation + PR
- [ ] `npm run db:test:prepare && npm test` ; `npx biome check --write . && npm run lint && npx tsc --noEmit` ; E2E complète.
- [ ] push + `gh pr create`. CI verte. Ne pas merger.
