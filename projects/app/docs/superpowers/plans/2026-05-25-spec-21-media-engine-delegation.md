# media-engine, couche média unique — Plan d'implémentation (spec 21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ContentOS délègue tout le média (calcul + stockage) à `media-engine` via une API HTTP `/v1`, perd son R2 et ses clés IA, et devient une couche domaine pure.

**Architecture :** `media-engine` (Cloudflare Worker, dépôt `/Users/ManuAVQN/Code/media-manager`) expose une API `/v1` à clé de service, à côté de son MCP. `content-os` (dépôt `/Users/ManuAVQN/Code/content-os-v2`) parle à cette API via un client `MediaEngine` (impl HTTP + stub in-memory pour tests).

**Tech Stack :** media-engine = TS sur Workers (wrangler, R2/D1/Browser Rendering, Vitest). content-os = Next.js, Drizzle/Postgres, BullMQ, Vitest (`integration`/`unit`/`worker`).

**Deux dépôts, deux PR :** phase 1 dans `media-manager` ; phases 2-5 dans `content-os-v2`. Aucun merge sur main, aucun déploiement : les deux finissent en PR pour relecture de Manu.

**Contrat `/v1` (référence pour tout le plan) :** auth `Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY>`. Réponses de création : `{ id, url, width, height }`.
- `POST /v1/generate` `{ prompt, aspectRatio, stylePrompt? }`
- `POST /v1/edit` `{ sourceId, prompt }`
- `POST /v1/render-html` `{ html, width, height }`
- `POST /v1/upload` corps binaire + `Content-Type` (PDF → width/height omis)
- `DELETE /v1/object/:id` → `{ deleted: boolean }`

---

## Phase 1 — `media-engine` : API `/v1` (dépôt `/Users/ManuAVQN/Code/media-manager`)

### Task 1.1 : extraire `store()` dans une lib partagée

**Files:** Create `src/lib/store.ts` ; Modify `src/tools.ts`.

- [ ] Déplacer la fonction `store(env, input)` et son type `StoreInput` de `tools.ts` vers `src/lib/store.ts` (export). `tools.ts` l'importe. Aucun changement de comportement.
- [ ] Vérifier : `npm test` (Vitest) reste vert, `npx tsc --noEmit` propre.
- [ ] Commit : `🤖 refactor: store() dans lib/store.ts (réutilisable par l'API /v1)`

### Task 1.2 : auth clé de service + binding env

**Files:** Modify `src/types.ts` (Env), `wrangler.toml`, Create `src/lib/service-auth.ts`, Test `test/service-auth.test.ts`.

- [ ] Ajouter `MEDIA_ENGINE_SERVICE_KEY: string` à `Env`. Documenter dans `wrangler.toml` (secret, pas en clair) et `.dev.vars`/README.
- [ ] `src/lib/service-auth.ts` : `function checkServiceKey(request: Request, env: Env): boolean` — compare le `Authorization: Bearer <…>` à `env.MEDIA_ENGINE_SERVICE_KEY` en **comparaison à temps constant** (réutiliser le pattern de `lib/auth-check.ts` s'il existe ; sinon comparer longueur + XOR). Renvoie false si absent/incorrect.
- [ ] TDD : test pur (clé correcte → true ; absente/incorrecte → false ; pas de timing-leak évident). Vitest.
- [ ] Commit : `🤖 feat: auth clé de service pour l'API /v1`

### Task 1.3 : routeur `/v1` monté à côté du MCP

**Files:** Create `src/v1.ts` (le routeur), Modify `src/index.ts`.

- [ ] `src/index.ts` : le `default export` devient un `fetch` qui, si `new URL(request.url).pathname` commence par `/v1`, délègue à `handleV1(request, env, ctx)` ; sinon délègue à l'`OAuthProvider` existant (inchangé pour `/mcp`, `/authorize`, etc.). Préserver le wrapping OAuth pour tout le reste.
- [ ] `src/v1.ts` : `handleV1` vérifie d'abord `checkServiceKey` (401 sinon), puis route par méthode+chemin vers les handlers des tasks 1.4-1.6. Réponses JSON `{ id, url, width, height }`. 401/400/404/500 propres avec corps `{ error }`.
- [ ] Vérifier : `tsc` propre. (Les handlers arrivent ensuite ; un squelette qui renvoie 501 est OK à ce commit.)
- [ ] Commit : `🤖 feat: routeur /v1 (auth service) monté à côté du MCP`

### Task 1.4 : `/v1/generate` + `/v1/edit`

**Files:** Modify `src/v1.ts`, `src/lib/gemini.ts`.

- [ ] `src/lib/gemini.ts` : aligner le modèle sur `gemini-3-pro-image-preview` (remplacer la constante de modèle actuelle). Garder les signatures `generateImage`/`editImage`.
- [ ] `POST /v1/generate` : parse `{ prompt, aspectRatio, stylePrompt? }` (Zod) → `prompt2 = stylePrompt ? prompt + "\n\nStyle: " + stylePrompt : prompt` → `generateImage(env, prompt2, aspectRatio)` → `store(env, {bytes, mimeType, prompt, parent_id:null, source:'gemini_generate', tags:[]})` → renvoyer `{ id, url, width, height }`.
- [ ] `POST /v1/edit` : parse `{ sourceId, prompt }` → `getImageRecord(env, sourceId)` (404 si absent) → `getImageBytes(env, rec.r2_key)` → `editImage(env, bytes, contentType, prompt)` → `store(... parent_id: sourceId, source:'gemini_edit')` → renvoyer `{ id, url, width, height }`.
- [ ] Vérifier : `tsc` propre, `npm test` vert. (Pas de test réseau Gemini — couvrir le parsing/erreurs en pur si faisable ; sinon vérifier par lecture + le smoke manuel restera à Manu au déploiement.)
- [ ] Commit : `🤖 feat: /v1/generate + /v1/edit (Gemini 3 pro image)`

### Task 1.5 : `/v1/render-html`

**Files:** Modify `src/v1.ts`.

- [ ] `POST /v1/render-html` : parse `{ html, width, height }` (Zod) → `renderHtml(env, { html, width, height })` → `store(... source:'html_render', width, height)` → `{ id, url, width, height }`.
- [ ] Vérifier : `tsc` propre, `npm test` vert.
- [ ] Commit : `🤖 feat: /v1/render-html`

### Task 1.6 : `/v1/upload` + `DELETE /v1/object/:id`

**Files:** Modify `src/v1.ts`.

- [ ] `POST /v1/upload` : lit le corps binaire (`await request.arrayBuffer()`) + `Content-Type` de l'en-tête → `store(env, { bytes, mimeType, prompt:null, parent_id:null, source:'upload', tags:[] })`. Ajouter `'upload'` au type `ImageSource` (`src/types.ts`). Pour un PDF, `parseImageDimensions` renverra null → `width/height` null, OK. Renvoyer `{ id, url, width, height }`.
- [ ] `DELETE /v1/object/:id` : réutiliser la logique de `delete_image` (getImageRecord → deleteImageRow → deleteObject) → `{ deleted }`.
- [ ] Vérifier : `tsc` propre, `npm test` vert.
- [ ] Commit : `🤖 feat: /v1/upload + delete`

### Task 1.7 : README + PR

- [ ] Documenter l'API `/v1` et le secret `MEDIA_ENGINE_SERVICE_KEY` dans le README.
- [ ] Brancher : `git checkout -b spec-21/api-v1`, push, ouvrir une PR (`gh pr create`). Ne pas déployer.

---

## Phase 2 — `content-os` : le client `MediaEngine` (dépôt `/Users/ManuAVQN/Code/content-os-v2`)

Travail en worktree isolé (`spec-21/media-engine`). Le client est la pièce maîtresse : impl HTTP réelle + stub in-memory.

### Task 2.1 : interface + types

**Files:** Create `src/lib/media-engine/types.ts`.

- [ ] Définir :
```ts
export type MediaObject = { id: string; url: string; width: number | null; height: number | null };
export interface MediaEngine {
  generate(input: { prompt: string; aspectRatio: string; stylePrompt?: string | null }): Promise<MediaObject>;
  edit(input: { sourceId: string; prompt: string }): Promise<MediaObject>;
  renderHtml(input: { html: string; width: number; height: number }): Promise<MediaObject>;
  upload(input: { bytes: Buffer; contentType: string }): Promise<MediaObject>;
  download(idOrUrl: string): Promise<Buffer>;
  delete(id: string): Promise<void>;
}
```
- [ ] Commit : `🤖 feat(media-engine): interface client`

### Task 2.2 : stub in-memory (TDD)

**Files:** Create `src/lib/media-engine/in-memory.ts`, Test `test/integration/media-engine-in-memory.test.ts` (ou unit — pur, pas de DB).

- [ ] **Test d'abord** : `generate`/`renderHtml`/`upload` renvoient un `MediaObject` avec id unique + url contenant l'id ; `download(url|id)` rend les bytes stockés ; `edit(sourceId)` crée un nouvel objet ; `delete` retire l'objet (download → throw ensuite). Dimensions : 1×1 pour generate/render (sentinelle), parse réel pour upload si trivial sinon 1×1.
- [ ] Implémenter `InMemoryMediaEngine implements MediaEngine` : `Map<id, {bytes, contentType, meta}>`, ids via `crypto.randomUUID()`, url = `memory://media/{id}`. `download` accepte un id ou une url `memory://…` (extraire l'id).
- [ ] Vérifier : le test passe.
- [ ] Commit : `🤖 feat(media-engine): stub in-memory + tests`

### Task 2.3 : impl HTTP réelle

**Files:** Create `src/lib/media-engine/http.ts`, `src/lib/media-engine/index.ts` (factory).

- [ ] `HttpMediaEngine implements MediaEngine` : `fetch(MEDIA_ENGINE_URL + '/v1/…', { headers: { Authorization: 'Bearer ' + key } })`. `generate/edit/renderHtml` POST JSON → parse `{id,url,width,height}`. `upload` POST bytes + `Content-Type`. `download` : GET sur l'url publique (si on lui passe un id, construire l'url via le record — en pratique on lui passe l'url stockée). `delete` : DELETE `/v1/object/:id`. Gérer les non-2xx (throw avec le corps).
- [ ] `src/lib/media-engine/index.ts` : `getMediaEngine(): MediaEngine` — renvoie `InMemoryMediaEngine` si `env.CONTENT_OS_MEDIA_STUB === '1'`, sinon `HttpMediaEngine` (avec `env.MEDIA_ENGINE_URL`, `env.MEDIA_ENGINE_SERVICE_KEY`). Ajouter ces 3 vars à `src/lib/env.ts` (URL + key optionnelles si stub).
- [ ] Vérifier : `tsc` propre. (L'impl HTTP n'est pas testée en réseau ; couverte par lecture + le stub pour les tests.)
- [ ] Commit : `🤖 feat(media-engine): impl HTTP + factory (stub via env)`

---

## Phase 3 — `content-os` : recâblage du calcul

### Task 3.1 : `generate-image.ts` → client

**Files:** Modify `src/lib/ai/generate-image.ts`, `src/worker/queues/generate-image.ts`, Test `test/integration/...` existants.

- [ ] `generate-image.ts` : `generateImage`/`editImage` délèguent au client (`getMediaEngine().generate(...)` / `.edit(...)`). Comme le moteur stocke déjà, ces fonctions renvoient désormais un `MediaObject` (id+url+dims), pas un `Buffer`. Adapter le type de retour.
- [ ] `src/worker/queues/generate-image.ts` : ne plus uploader en R2 ni mesurer les dimensions localement. Flux : (edit) résoudre `sourceMediaId` → `media.assetKey` (= id moteur) → `mediaEngine.edit({ sourceId, prompt })` ; (generate) résoudre `styleId` → stylePrompt → `mediaEngine.generate(...)`. Puis enregistrer `media` avec `assetKey = obj.id`, `width/height = obj.width/height`, et `image_assets` comme avant. Renvoyer `{ mediaId, url: obj.url, width, height }`.
- [ ] Retirer la clé Gemini du worker (plus d'appel `getApiKey(userId,'gemini')`).
- [ ] Mettre à jour les tests d'intégration concernés pour le stub `MediaEngine` (plus de stub Gemini/R2). Vérifier verts.
- [ ] Commit : `🤖 refactor(media): generate-image délègue au media-engine`

### Task 3.2 : `render.ts` → client

**Files:** Modify `src/lib/visual-templates/render.ts`, `src/worker/queues/render-visual.ts`.

- [ ] `render.ts` : `renderHtmlToPng({html,width,height})` délègue à `getMediaEngine().renderHtml(...)` → renvoie un `MediaObject`. `compile.ts` reste intact.
- [ ] `render-visual.ts` : compile (inchangé) → `mediaEngine.renderHtml` ; mode `preview` : renvoyer `obj.url` (pas d'enregistrement) ; mode `final` : enregistrer `media.assetKey = obj.id` + `image_assets` comme avant. Résolution des variables image : utiliser l'URL publique du média référencé (plus de `signedUrl`).
- [ ] Mettre à jour les tests d'intégration concernés (stub). Vérifier verts.
- [ ] Commit : `🤖 refactor(media): render-visual délègue au media-engine`

---

## Phase 4 — `content-os` : recâblage du stockage

### Task 4.1 : uploads utilisateur → moteur

**Files:** Modify les actions d'upload (galerie `src/app/(app)/media/actions.ts`, image de post, et `src/lib/media/*` d'upload) + le repo `media`.

- [ ] Remplacer les `storage.upload(...)` d'images uploadées par `mediaEngine.upload({ bytes, contentType })` ; enregistrer `media.assetKey = obj.id`. Valider le type/upload comme avant.
- [ ] Tests verts (stub).
- [ ] Commit : `🤖 refactor(media): uploads utilisateur via media-engine`

### Task 4.2 : carrousels (download + upload PDF) → moteur

**Files:** Modify `src/lib/carousel/carousel-core.ts` et le worker carrousel.

- [ ] Récupérer les bytes des images sources via `mediaEngine.download(media.url|id)` (au lieu de `storage.download(r2key)`). Assembler le PDF (`pdf-lib`, inchangé). Stocker le PDF via `mediaEngine.upload({ bytes: pdf, contentType: 'application/pdf' })` ; `media.assetKey = obj.id`, `kind='carousel'`.
- [ ] Tests verts (stub).
- [ ] Commit : `🤖 refactor(media): carrousels via media-engine`

### Task 4.3 : publication LinkedIn (lecture) → moteur

**Files:** Modify `src/lib/linkedin/publish.ts` (ou le worker publish).

- [ ] Là où la publication lit les bytes du média depuis R2, lire via `mediaEngine.download(media.url|id)` avant l'upload vers LinkedIn. Reste inchangé par ailleurs.
- [ ] Tests verts (stub).
- [ ] Commit : `🤖 refactor(media): publication LinkedIn lit via media-engine`

### Task 4.4 : galerie + résolution d'URL

**Files:** Modify `src/lib/db/repositories/image-assets.ts` (et tout point renvoyant une URL signée).

- [ ] `listStandaloneImages` et toute lecture d'URL : renvoyer l'**URL publique** du moteur pour `media.assetKey` (un helper `mediaUrl(media)` qui mappe id→url, ou stocker l'url à la création et la lire). Supprimer les appels `signedUrl`.
- [ ] Tests verts (stub).
- [ ] Commit : `🤖 refactor(media): galerie sur URLs publiques media-engine`

---

## Phase 5 — `content-os` : suppressions

### Task 5.1 : retirer la couche storage R2

**Files:** Delete `src/lib/storage/` (r2, filesystem, in-memory, types) ; Modify les imports résiduels ; Delete la route `src/app/api/storage/*` ; Modify `src/lib/env.ts` (retirer R2_*).

- [ ] `grep -rn "lib/storage\|R2_ACCOUNT\|signedUrl\|/api/storage" src/` → traiter chaque résidu. Supprimer la couche + la route proxy + les vars R2 d'env. Retirer la dépendance `@aws-sdk/*` de `package.json` si plus utilisée.
- [ ] `tsc --noEmit` propre + suites vertes.
- [ ] Commit : `🤖 refactor(media): retire la couche storage R2 (tout passe par media-engine)`

### Task 5.2 : retirer le provider Gemini d'api_credentials

**Files:** Modify `src/lib/db/schemas/api-credentials.ts`, `repositories/api-credentials.ts`, la page réglages `api-keys`, tests.

- [ ] `ApiProvider` n'a plus aucune valeur → si la table devient inutile (plus aucun provider), retirer aussi la page réglages « API keys », les tools/usages, et la table (migration de drop) ; sinon réduire à vide. Décider selon ce qui reste : après ce chantier, **aucune clé IA** côté ContentOS → retirer `api_credentials` entièrement (schéma + repo + UI + tools MCP + tests + migration de drop).
- [ ] `tsc` propre + suites vertes (`db:test:prepare` après la migration).
- [ ] Commit : `🤖 refactor(settings): retire api_credentials (ContentOS ne porte plus aucune clé IA)`

### Task 5.3 : stubs

**Files:** Modify `src/lib/env.ts` + tout usage de `CONTENT_OS_GEMINI_STUB` / `CONTENT_OS_PUPPETEER_STUB`.

- [ ] Retirer ces deux stubs (remplacés par `CONTENT_OS_MEDIA_STUB`). S'assurer que la config de test active `CONTENT_OS_MEDIA_STUB=1`.
- [ ] Commit : `🤖 chore(test): stub media-engine remplace les stubs Gemini/Puppeteer`

---

## Phase 6 — Vérification & PR

### Task 6.1 : vérification globale (content-os)

- [ ] `npx tsc --noEmit` propre.
- [ ] `npm run test:unit`, `npm run test:integration`, `npm run test:worker` → tous verts (via le stub `MediaEngine`).
- [ ] `grep -rn "R2_\|lib/storage\|signedUrl\|GEMINI_STUB\|PUPPETEER_STUB\|api_credentials\|getApiKey" src/ test/` → aucun résidu inattendu.
- [ ] Confirmer que `compile.ts` (Handlebars) est toujours local et intact.

### Task 6.2 : PR

- [ ] Push la branche `spec-21/media-engine`, ouvrir la PR `content-os-v2`. Décrire : délégation média complète, R2 + clés IA retirés, le bout-en-bout réel nécessite le déploiement du media-engine (PR du dépôt `media-manager`) + les secrets.
- [ ] Ne pas merger, ne pas déployer.

## Notes d'exécution

- **E2E** non lancés (build prod requis) ; la CI les valide. Les helpers E2E média (génération/upload) doivent fonctionner via le stub si la config de test l'active.
- **Bout-en-bout réel** (ContentOS → media-engine déployé) = étape manuelle de Manu : déployer la PR media-manager, poser `MEDIA_ENGINE_SERVICE_KEY` (des deux côtés) + `MEDIA_ENGINE_URL` + la clé Gemini, puis fumer un generate/render.
- **Données existantes** : les `media` antérieurs (clés R2) ne résolvent plus ; non migrés (dev).
