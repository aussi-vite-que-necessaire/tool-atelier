# Spec 6 (Image library : upload + génération IA + galerie) Design

> **Position dans la roadmap v2** : 6e spec sur 8. Suit Spec 5 (visual templates) qui a posé le pipeline media (queue render-visual, picker sur `/posts/[id]`, FilesystemStorage/R2). Cette spec ajoute le **socle images standalone** : créer une image par upload ou génération IA, la stocker dans une galerie réutilisable, et l'attacher à un post.

## Objectif

Permettre à un user signé de :

1. **Uploader une image** depuis son ordinateur → image standalone dans la galerie.
2. **Générer une image avec l'IA** (Gemini) depuis un prompt → image standalone dans la galerie.
3. **Voir sa galerie** d'images standalone et en supprimer.
4. **Attacher une image** (uploadée, générée, ou choisie dans la galerie) à un post — en plus de l'option "depuis un template" livrée en Spec 5.

Le terme "image standalone" = une image qui vit dans la bibliothèque du projet, indépendamment d'un template. Techniquement : une row `media` (kind='image') + une row `image_assets` (source='standalone').

## Scope

**Inclus :**

- Dépendances : `@google/genai` (Gemini), `image-size` (lecture dimensions, pure JS, pas de natif).
- Repository : extension de `image-assets.ts` avec `listStandaloneImages(userId)` (join media + image_assets, source='standalone', tri récent).
- Module storage : réutilise `getStorage()` (FilesystemStorage dev/E2E, R2 prod) posé en Spec 5.
- **Upload** : Server Action synchrone `uploadImageAction` (validation type/taille, lecture dimensions, upload, création media+image_asset).
- **Génération IA** : nouvelle queue BullMQ `generate-image` + worker `processGenerateImage` (Gemini → PNG → upload → media+image_asset). Stub `CONTENT_OS_GEMINI_STUB=1`.
- **Galerie** : page `/media` (grille de vignettes, suppression, bouton "Ajouter une image"). Lien sidebar.
- **Module réutilisable `<AddImageDialog>`** (onglets Upload | Générer IA), utilisé par la galerie ET le post picker.
- **Post picker** : extension de l'`AddVisualDialog` (Spec 5) avec les options Upload / Générer IA / Choisir dans la galerie, à côté de l'option Template existante.
- Server Actions : `uploadImageAction`, `enqueueGenerateImageAction`, `attachExistingMediaAction`, `deleteImageAction`.
- Tests : unit (compo prompt, validation upload), integration (actions + `listStandaloneImages` + tenant isolation), worker (generate-image + stub), e2e (upload, génération stub, attache, réutilisation galerie, suppression).

**Hors scope (specs suivants) :**

- Édition IA image-to-image (prend une image existante + prompt → nouvelle image). Le schéma a déjà `aiSourceKey` pour ça.
- Images dans les templates (type de variable `image` dans le DSL, compositing). C'est le spec d'après.
- Variables non-string dans les templates (`color`, `list`, `toggle`).
- Multi-images par post côté UI (le schéma le permet, l'UI MVP reste mono-image).
- Carousels / vidéos.
- Crop / recadrage d'image après upload.
- Régénération / variations d'une image IA.

## Décisions cadres (validées en brainstorm)

| Décision | Choix retenu |
|---|---|
| Provider IA image | Gemini direct (`@google/genai`), modèle `gemini-3-pro-image-preview` |
| Contenu galerie | Images standalone seulement (pas les renders de templates) |
| Attache à un post | Référence partagée (pas de copie) : `posts.media_id` pointe vers le media de la galerie |
| Lecture dimensions upload | Lib `image-size` (pure JS) |
| Queue génération IA | Nouvelle queue dédiée `generate-image` (séparée de render-visual) |
| Style IA | Réutilise la table `visual_styles` (Spec 3) — dropdown optionnel |
| Route galerie | `/media` |
| Upload | Server Action synchrone (pas de queue) |

## Modèle de données

**Aucune nouvelle table, aucune migration.** Le schéma posé en Spec 2/3 couvre déjà le besoin :

- `media` : `id`, `userId`, `kind` ('image'), `assetKey`, `previewKey`, `width`, `height`, timestamps.
- `image_assets` : `mediaId` (PK/FK), `source` ('template' | 'standalone'), `templateSlug` (null pour standalone), `vars` (null), `aiBrief` (prompt pour IA, null pour upload), `aiSourceKey` (null — réservé édition image-to-image), `styleId` (FK visual_styles, optionnel).
- `posts.media_id` : FK nullable vers media, `ON DELETE SET NULL` (déjà en place).

**Sémantique de la référence partagée :**

- Attacher une image de la galerie à un post : `updatePost(userId, postId, { mediaId })`. Plusieurs posts peuvent référencer le même media.
- Détacher (`detachMediaAction`, déjà existant Spec 5) : `media_id = null`. L'image reste dans la galerie.
- Supprimer une image de la galerie (`deleteImageAction`) : `deleteMedia` → cascade delete sur `image_assets`, et les posts qui la référencaient passent `media_id = null` (FK SET NULL). Conséquence assumée : supprimer une image de la galerie retire le visuel des posts qui l'utilisaient. L'UI de suppression affiche un avertissement si des posts la référencent (compteur).

### Repository

**`src/lib/db/repositories/image-assets.ts`** — ajout :

```ts
export type StandaloneImage = {
  media: Media;
  asset: ImageAsset;
};

export async function listStandaloneImages(userId: string): Promise<StandaloneImage[]> {
  const rows = await db
    .select({ media, asset: imageAssets })
    .from(imageAssets)
    .innerJoin(media, eq(imageAssets.mediaId, media.id))
    .where(and(eq(media.userId, userId), eq(imageAssets.source, 'standalone')))
    .orderBy(desc(media.createdAt));
  return rows.map((r) => ({ media: r.media, asset: r.asset }));
}

export async function countPostsUsingMedia(userId: string, mediaId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.mediaId, mediaId)));
  return row?.c ?? 0;
}
```

`countPostsUsingMedia` sert l'avertissement de suppression. Import croisé `posts` dans `image-assets.ts` acceptable (rare).

## Upload

**`src/app/(app)/media/upload-action.ts`** (et core testable `upload-action-core.ts`) :

```ts
const ALLOWED = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadImageCore(
  userId: string,
  file: File,
  opts: { postId?: string } = {},
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext) return { status: 'error', message: 'Format non supporté (png, jpg, webp).' };
  if (file.size > MAX_BYTES) return { status: 'error', message: 'Image trop lourde (max 10 Mo).' };

  const bytes = Buffer.from(await file.arrayBuffer());
  const dims = imageSize(bytes); // { width, height } via 'image-size'
  if (!dims.width || !dims.height) return { status: 'error', message: 'Image illisible.' };

  const mediaId = createId();
  const assetKey = `media/${userId}/${mediaId}.${ext}`;
  await getStorage().upload({ key: assetKey, body: bytes, contentType: file.type });
  await createMedia(userId, {
    kind: 'image', assetKey, previewKey: assetKey, width: dims.width, height: dims.height,
  }, mediaId);
  await createImageAsset(userId, { mediaId, source: 'standalone' });

  if (opts.postId) await updatePost(userId, opts.postId, { mediaId });
  return { status: 'success', mediaId };
}
```

La Server Action wrapper `uploadImageAction(formData)` extrait `file` + `postId?`, appelle `requireUserId`, délègue au core, revalide les paths concernés. Synchrone : pas de rendu, juste stockage + DB (~100ms).

## Génération IA

### Provider

`src/lib/ai/generate-image.ts` :

```ts
import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';

const MODEL = 'gemini-3-pro-image-preview';

export type GenerateImageFn = (opts: {
  prompt: string;
  aspectRatio: string;
  stylePrompt?: string | null;
}) => Promise<Buffer>;

export const generateImage: GenerateImageFn = async ({ prompt, aspectRatio, stylePrompt }) => {
  const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
  const fullPrompt = stylePrompt ? `${prompt}\n\nStyle : ${stylePrompt}` : prompt;
  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    config: { imageConfig: { aspectRatio } },
  } as Parameters<typeof gemini.models.generateContent>[0]);
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error('Gemini: pas d\'image dans la réponse');
  return Buffer.from(imagePart.inlineData.data, 'base64');
};

// Stub : PNG 1x1 (CI/E2E sans Gemini).
export const generateImageStub: GenerateImageFn = async () => STUB_PNG;
```

`STUB_PNG` = même 1x1 transparent que `render.ts`. Sélection stub vs réel dans le worker entrypoint via `env.CONTENT_OS_GEMINI_STUB === '1'` (cohérent avec `CONTENT_OS_AI_STUB` / `CONTENT_OS_PUPPETEER_STUB`).

**Aspect ratios exposés** (LinkedIn-pertinents, légaux Gemini) : `1:1`, `4:5`, `16:9`. Le `1.91:1` des liens LinkedIn est approximé par `16:9`. Constante `IMAGE_ASPECT_RATIOS` partagée UI + validation.

### Queue & worker

**`src/lib/queue/client.ts`** — ajout :

```ts
export type GenerateImageJob = {
  userId: string;
  prompt: string;
  aspectRatio: string;
  styleId?: string;
  postId?: string;
  jobKey: string;
};
export type GenerateImageResult = {
  mediaId: string;
  signedUrl: string;
  width: number;
  height: number;
};
export const generateImageQueue = new Queue<GenerateImageJob, GenerateImageResult>('generate-image', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
```

Ajout dans `enqueue.ts` (`enqueueGenerateImage`) et `registry.ts` (`'generate-image'`).

**`src/worker/queues/generate-image.ts`** :

```ts
type Deps = { storage: Storage; generateImage: GenerateImageFn };

export function makeProcessGenerateImage(deps: Deps) {
  return async function processGenerateImage(job: Job<GenerateImageJob>): Promise<GenerateImageResult> {
    const { userId, prompt, aspectRatio, styleId, postId, jobKey } = job.data;

    let stylePrompt: string | null = null;
    if (styleId) {
      const style = await getVisualStyle(userId, styleId);
      stylePrompt = style?.prompt ?? null;
    }

    const png = await deps.generateImage({ prompt, aspectRatio, stylePrompt });
    const dims = imageSize(png);

    const mediaId = createId();
    const assetKey = `media/${userId}/${mediaId}.png`;
    await deps.storage.upload({ key: assetKey, body: png, contentType: 'image/png' });
    await createMedia(userId, {
      kind: 'image', assetKey, previewKey: assetKey,
      width: dims.width ?? 1024, height: dims.height ?? 1024,
    }, mediaId);
    await createImageAsset(userId, { mediaId, source: 'standalone', aiBrief: prompt, styleId: styleId ?? null });

    if (postId) {
      const post = await getPost(userId, postId);
      if (post) await updatePost(userId, postId, { mediaId });
    }

    const signedUrl = await deps.storage.signedUrl({ key: assetKey, expiresInSeconds: 3600 });
    return { mediaId, signedUrl, width: dims.width ?? 1024, height: dims.height ?? 1024 };
  };
}
```

Enregistré dans `src/worker/index.ts` (concurrency 2). `jobKey` UUID sert d'idempotency/capability token pour le polling, cohérent Spec 4/5.

### Server Action

`enqueueGenerateImageAction({ prompt, aspectRatio, styleId?, postId? })` : `requireUserId`, valide prompt non-vide + aspectRatio ∈ presets, enqueue avec jobKey UUID, retourne `{ jobKey }`. Polling via `useJobPolling(jobKey, { queue: 'generate-image' })`.

## Galerie `/media`

**`src/app/(app)/media/page.tsx`** — Server Component :

- `listStandaloneImages(userId)` + signed URLs (Promise.all).
- Grille responsive de `<ImageCard>` : vignette, badge source (Upload / IA), date, bouton supprimer (dialog confirm avec compteur `countPostsUsingMedia`).
- Header : titre + bouton "Ajouter une image" qui ouvre `<AddImageDialog>` (sans postId → ajoute juste à la galerie).
- Vide → empty state.

**Lien sidebar** : `src/components/layout/*` (ou la nav principale `/app`) — ajouter "Galerie" (ou "Médias") à côté de Idées / Posts. À localiser via grep (la nav principale n'est pas `settings-sidebar.tsx` qui est pour /settings).

## Module `<AddImageDialog>`

`src/components/media/add-image-dialog.tsx` (Client) — réutilisable :

- Props : `{ open, onOpenChange, postId?, onCreated?(mediaId) }`.
- Onglet **Upload** : `<input type=file accept="image/png,image/jpeg,image/webp">` → `uploadImageAction(formData)` (avec postId si fourni) → toast + `onCreated`.
- Onglet **Générer IA** : textarea prompt + select aspect ratio + select style (visual_styles, optionnel "Aucun") + bouton Générer → `enqueueGenerateImageAction` → polling → preview de l'image générée → toast + `onCreated`.
- Sans `postId` (galerie) : l'image est créée et apparait dans la galerie (router.refresh).
- Avec `postId` (post picker) : l'image est créée ET attachée au post.

## Post picker (extension Spec 5)

`src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` — l'étape 1 (sélection) gagne 4 entrées au lieu de 1 :

- **Depuis un template** (flux Spec 5 existant, inchangé).
- **Uploader une image** → onglet Upload du module → attache au post.
- **Générer avec l'IA** → onglet IA du module → attache au post.
- **Choisir dans la galerie** → liste `listStandaloneImages`, clic sur une image → `attachExistingMediaAction({ postId, mediaId })` → attache (référence partagée).

`attachExistingMediaAction` vérifie l'ownership du media (via getMedia scopé) avant `updatePost`. Refactor : le sous-flux Upload/IA peut réutiliser `<AddImageDialog>` en mode `postId`.

## Env

`src/lib/env.ts` — ajouts :

```ts
GEMINI_API_KEY: z.string().optional(),
CONTENT_OS_GEMINI_STUB: z.enum(['0', '1']).default('0'),
```

`.env.example` documenté. CI/E2E : `CONTENT_OS_GEMINI_STUB=1` (global-setup E2E le propage au worker, comme PUPPETEER_STUB).

## Tests

### Unit (`vitest --project=unit`)

Deux fonctions pures extraites pour être testables sans DB ni storage :

- `validateUploadFile(file: { type: string; size: number })` dans `src/lib/media/validate-upload.ts` → retourne `{ ok: true; ext } | { ok: false; message }`. Test : png/jpg/webp acceptés, autres rejetés, taille > 10 Mo rejetée.
- `composeImagePrompt(prompt, stylePrompt?)` dans `src/lib/ai/generate-image.ts` → `prompt` seul ou `prompt + "\n\nStyle : " + stylePrompt`. Test : avec et sans style.

`uploadImageCore` (qui touche DB+storage) est couvert en integration, pas en unit.

### Integration (`vitest --project=integration`)

- `test/integration/upload-image-action.test.ts` : upload OK (crée media+image_asset standalone), rejette format/taille, attache si postId, tenant isolation.
- `test/integration/standalone-images-repository.test.ts` : `listStandaloneImages` ne renvoie que source=standalone du bon user ; `countPostsUsingMedia`.
- `test/integration/attach-existing-media-action.test.ts` : attache un media de la galerie à un post ; refuse un media d'un autre user.
- `test/integration/delete-image-action.test.ts` : supprime → media parti, posts référents passés à media_id null.
- `test/integration/tenant-isolation.test.ts` : étendre si besoin (media/image_assets déjà couverts).

### Worker (`vitest --project=worker`)

- `test/worker/generate-image.test.ts` : happy path (mock `generateImage` → Buffer → crée media+image_asset standalone avec aiBrief) ; avec postId attache ; avec styleId charge le style ; pas d'appel Gemini réel.

### E2E Playwright (`test:e2e`)

- `test/e2e/media-gallery.spec.ts` : galerie vide → générer une image via IA (stub) → apparait → supprimer.
- `test/e2e/post-image.spec.ts` : post → "Ajouter un visuel" → Générer IA (stub) → attaché → détacher → "Choisir dans la galerie" → ré-attaché.
- Stubs : `CONTENT_OS_GEMINI_STUB=1` + `E2E_TESTING=true` (FilesystemStorage partagé), comme Spec 5.

## Décisions techniques tranchées

- **Provider Gemini direct** : chemin v1 éprouvé, image-to-image natif pour la future édition, cohérent avec le pattern direct-SDK du projet (`@anthropic-ai/sdk`).
- **Référence partagée (pas de copie)** : matche le FK `posts.media_id`, moins de stockage, sémantique "bibliothèque". Trade-off assumé : supprimer une image de la galerie retire le visuel des posts référents (avertissement UI).
- **Upload synchrone, génération IA async** : l'upload est rapide (stockage + dims), la génération IA prend des secondes (Gemini) → queue + polling comme render-visual.
- **`image-size` plutôt que `sharp`** : on n'a besoin que des dimensions, pas de transformation. Pure JS, pas de binaire natif (cohérent avec la philosophie de déploiement légère).
- **Queue `generate-image` séparée** : job distinct de render-visual (Gemini vs Puppeteer), worker config et concurrency indépendantes.
- **Réutilisation `visual_styles`** : la table existe (Spec 3), conçue pour l'injection de style IA. Dropdown optionnel.

## Migration & déploiement

1. `npm install @google/genai image-size`.
2. Pas de migration DB (schéma déjà conforme).
3. `.env.example` : `GEMINI_API_KEY=`, `CONTENT_OS_GEMINI_STUB=0`.
4. Worker porte désormais 4 queues : dummy, generate-post, render-visual, generate-image.
5. Sans `GEMINI_API_KEY` en dev : la génération IA échoue proprement (toast d'erreur) ; upload + galerie fonctionnent. `CONTENT_OS_GEMINI_STUB=1` pour tester le flux sans clé.

## Critères de réussite

- Galerie `/media` accessible (vide ou peuplée).
- Upload d'un PNG/JPG/WebP valide → apparait dans la galerie ; format/taille invalides rejetés avec message.
- Génération IA depuis un prompt (+ aspect + style optionnel) → polling → image dans la galerie.
- Supprimer une image de la galerie : confirmée (avertissement si posts référents), disparait, posts concernés repassent sans visuel.
- Sur `/posts/[id]` : "Ajouter un visuel" propose Template / Upload / Générer IA / Galerie. Chaque voie attache une image au post et l'affiche.
- "Détacher" délie sans supprimer de la galerie ; "Choisir dans la galerie" ré-attache une image existante.
- Deux users ne voient jamais les images l'un de l'autre (tenant isolation verte).
- `npm test` vert (unit + integration + worker, Gemini stubbé). `npm run test:e2e` vert (Gemini + storage stubbés). Lint + tsc clean.

## Hors-scope rappelé

- Édition IA image-to-image (spec suivant — `aiSourceKey` déjà prévu).
- Images dans les templates / DSL `image` type (spec suivant).
- Variables `color` / `list` / `toggle`.
- Multi-images par post (UI).
- Crop / variations / régénération.
- Carousels / vidéos.
