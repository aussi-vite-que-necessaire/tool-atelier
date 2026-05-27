# Spec 21 — media-engine, couche média unique

Date : 2026-05-25
Direction : `2026-05-25-direction-os-pour-agents-design.md` (chantier média).

## Objectif

ContentOS délègue **tout le média** — calcul (génération IA, rendu HTML→PNG) **et** stockage — au service `media-engine`. ContentOS perd son R2 et ses clés IA, et redevient une couche domaine pure (idées, posts, métadonnées média, liens). `media-engine` devient l'unique couche média du système, réutilisable hors ContentOS.

## Architecture cible

```
ContentOS — domaine : idées · posts · métadonnées media/image_assets · liens
   │  HTTP /v1/*  (auth : clé de service unique partagée)
   ▼
media-engine (Cloudflare) — calcul PIXEL + STOCKAGE de tous les binaires
   generate · edit · render-html · upload · delete  →  { id, url, width, height }
   clé Gemini (gemini-3-pro-image-preview) · Browser Rendering · R2 + D1
```

ContentOS garde ses tables `media` / `image_assets` ; le champ `assetKey` (et `previewKey`) stocke désormais un **id d'objet media-engine** au lieu d'un chemin R2. L'affichage utilise l'**URL publique** servie par le moteur. La compilation Handlebars→HTML **reste** dans ContentOS ; seul le rendu pixel part au moteur.

## Le contrat `/v1`

Endpoints HTTP du `media-engine`, distincts de son interface MCP (qui reste pour les agents). Auth : en-tête `Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY>` (clé de service unique). Toutes les réponses de création : `{ id: string, url: string, width: number, height: number }`.

- `POST /v1/generate` — `{ prompt, aspectRatio, stylePrompt? }` → image générée (Gemini).
- `POST /v1/edit` — `{ sourceId, prompt }` → variante (le moteur lit son propre objet `sourceId`, pas de round-trip de bytes).
- `POST /v1/render-html` — `{ html, width, height }` → PNG (Cloudflare Browser Rendering). HTML déjà fini, le moteur reste template-agnostique.
- `POST /v1/upload` — corps binaire + `Content-Type` (ou `{ base64, contentType }`) → stocke tel quel (uploads utilisateur, PDF de carrousels). Renvoie `width`/`height` pour les images, omis pour les PDF.
- `DELETE /v1/object/:id` — supprime l'objet.

Le **download** se fait via l'URL publique renvoyée (pas d'endpoint dédié) : assemblage PDF et publication LinkedIn récupèrent les bytes par un simple GET.

## Côté `media-engine`

- **API HTTP `/v1`** ci-dessus, montée à côté du handler MCP existant. Auth par clé de service (en-tête), validée par un middleware ; secret en variable d'env Worker.
- **Modèle Gemini** aligné sur `gemini-3-pro-image-preview` pour ne pas régresser la qualité actuelle de ContentOS.
- Réutilise les libs existantes : `lib/gemini.ts` (generate/edit), `lib/browser.ts` (render-html), `lib/r2.ts` (put/publicUrl/delete), `lib/db.ts` (métadonnées). `/v1/upload` réutilise le chemin de stockage (R2 + D1) sans calcul.
- `/v1/edit` accepte un `sourceId` : le moteur récupère l'objet par son id (déjà stocké chez lui), édite, stocke la variante avec `parent_id`.

## Côté `content-os`

### Le client `MediaEngine`

Une interface unique avec deux implémentations :
- **HTTP réelle** — appelle `/v1/*` avec `MEDIA_ENGINE_URL` + `MEDIA_ENGINE_SERVICE_KEY`.
- **Stub in-memory** — stocke les bytes dans une `Map`, renvoie des ids/URLs déterministes et des dimensions factices (PNG 1×1), pour les tests et le dev sans moteur déployé. Sélection par variable d'env (ex. `CONTENT_OS_MEDIA_STUB=1`), sur le modèle des stubs actuels.

Interface (méthodes) : `generate`, `edit`, `renderHtml`, `upload`, `download(url|id)`, `delete`. Signatures alignées sur les libs actuelles pour minimiser l'impact sur les workers.

### Recâblage

- `src/lib/ai/generate-image.ts` → délègue à `mediaEngine.generate` / `mediaEngine.edit`.
- `src/lib/visual-templates/render.ts` → `renderHtmlToPng` délègue à `mediaEngine.renderHtml` (la compilation `compile.ts` reste inchangée et locale).
- **Workers** `generate-image`, `render-visual` : au lieu d'uploader en R2 et de stocker un chemin R2, ils enregistrent l'**id media-engine** renvoyé dans `media.assetKey` ; les enregistrements `media` / `image_assets` restent par ailleurs identiques. L'URL d'affichage est l'URL publique du moteur.
- **Uploads utilisateur** (galerie, image de post) → `mediaEngine.upload`.
- **Carrousels** : l'assemblage `pdf-lib` reste dans ContentOS ; il récupère les images par GET sur leurs URLs publiques, assemble le PDF, puis `mediaEngine.upload` le PDF.
- **Previews de templates** (`mode: 'preview'`) → `mediaEngine.renderHtml`, URL renvoyée directement, sans enregistrement DB (comme aujourd'hui).
- **Publication LinkedIn** : le worker récupère les bytes du média par GET sur l'URL publique avant l'upload vers LinkedIn.
- **Galerie** (`listStandaloneImages`) : renvoie l'URL publique du moteur au lieu d'une URL signée R2.

### Suppressions

- `src/lib/storage/` (R2, filesystem, in-memory) et son interface `Storage`.
- La route proxy `/api/storage` (upload/download R2).
- Les variables d'env R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) et la dépendance S3 si plus utilisée.
- Le provider `gemini` d'`api_credentials` (type, `PROVIDERS`, UI réglages, tests). ContentOS ne porte alors **plus aucune clé IA** ; la page réglages « API keys » disparaît si elle devient vide.
- Les stubs `CONTENT_OS_GEMINI_STUB` / `CONTENT_OS_PUPPETEER_STUB` sont remplacés par le stub du client `MediaEngine`.

## Testabilité

Le stub in-memory du client `MediaEngine` préserve la stratégie actuelle : les tests d'intégration et E2E tournent sans moteur déployé, avec des images sentinelles 1×1 et un stockage mémoire. Aucun test ne doit dépendre d'un `media-engine` réseau.

## Données existantes

Les enregistrements `media` antérieurs pointent vers des clés R2 qui ne résolvent plus après le retrait du R2. Périmètre : on **ne migre pas** les binaires existants (données de dev). Une migration de production (copier R2→media-engine, réécrire `assetKey`) ferait l'objet d'un script dédié, hors de ce spec.

## Prérequis & déploiement

- `media-engine` sur le tier **Cloudflare Workers payant** (Browser Rendering pour `render-html`).
- Secrets : `MEDIA_ENGINE_SERVICE_KEY` (identique des deux côtés), `MEDIA_ENGINE_URL` côté ContentOS, clé Gemini côté moteur.
- Le déploiement du moteur et la mise en place des secrets restent une action manuelle (hors implémentation automatisée).

## Découpage (chaque phase = frontière de commit ; chaque dépôt = sa PR)

1. **media-engine** — API `/v1` + auth clé de service + modèle Gemini aligné. Tests.
2. **content-os** — client `MediaEngine` (HTTP + stub in-memory), en TDD.
3. **content-os** — recâblage calcul (generate-image, render) sur le client.
4. **content-os** — recâblage stockage (uploads, carrousels, previews, publication, galerie).
5. **content-os** — suppressions (couche storage, `/api/storage`, env R2, provider gemini).
6. **Vérification** — suites vertes via le stub, `tsc` propre. (Le bout-en-bout réel contre un moteur déployé reste une étape manuelle de Manu.)

## Hors périmètre

- URLs signées / contenu confidentiel (le modèle reste public ; signé ajouté plus tard si besoin).
- Scoping par tenant dans le moteur (la multi-tenance reste portée par les métadonnées ContentOS).
- Connecteur MCP distant + OAuth, variantes GPT/Gemini, multi-plateformes sociales.
- Migration des binaires R2 existants.
