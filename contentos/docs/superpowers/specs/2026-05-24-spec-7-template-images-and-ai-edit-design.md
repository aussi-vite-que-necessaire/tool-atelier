# Spec 7 (Images dans les templates + édition IA) Design

> **Position dans la roadmap v2** : 7e spec. Suit Spec 5 (visual templates) et Spec 6 (image library : upload, génération IA, galerie). Cette spec complète le thème visuel : (A) un template peut intégrer une ou plusieurs **variables image** (pioche dans la galerie / upload / IA), et (B) on peut **éditer une image existante avec l'IA** (image-to-image) depuis la galerie.

## Objectif

1. **Variables image dans les templates** : un template visuel peut déclarer des variables de type `image`. Au moment de générer le visuel sur un post, l'utilisateur fournit une image par variable (choisie dans la galerie, ou ajoutée par upload/IA). Le rendu Puppeteer compose ces images dans le PNG final (ex : before/after, photo + texte).
2. **Édition IA image-to-image** : depuis la galerie, éditer une image existante avec un prompt (Gemini) → produit une **nouvelle** image standalone (l'originale est conservée).

Inclut une **simplification du storage** : R2 en dev + prod (au lieu du FilesystemStorage en dev), pour la parité prod et parce que le rendu d'images-dans-templates charge les images via URL depuis le storage (Puppeteer doit pouvoir les fetch).

## Scope

**Inclus :**

- **DSL** (`src/lib/visual-templates/dsl.ts`) : `VariableSpec` devient une union discriminée par `type` — ajout du variant `image` à côté de `string`.
- **Éditeur back-office** (`VariablesSchemaEditor`) : sélecteur de `type` (texte | image) par variable.
- **Compile + worker render-visual** : résolution des variables image (`mediaId` → URL signée R2) injectées dans le contexte Handlebars ; placeholder en preview.
- **Formulaire de vars du post** (`VariablesForm`) : input image (sélection galerie + bouton ajouter upload/IA) pour les variables image.
- **Storage** : ajout de `download(key): Promise<Buffer>` à l'interface (R2/InMemory/Filesystem) ; `getStorage()` simplifié — R2 en dev+prod, InMemory en tests unit/integration/worker, Filesystem uniquement en E2E.
- **Provider Gemini** : `editImage({ imageBytes, mimeType, prompt })` (image-to-image) + `editImageStub`.
- **Worker generate-image** : `GenerateImageJob.sourceMediaId?` → branche édition (download source → editImage), sinon génération texte→image.
- **Action + UI galerie** : `enqueueEditImageAction({ mediaId, prompt })` + bouton « Éditer avec l'IA » sur chaque `ImageCard` (mini-dialog prompt → polling → nouvelle image).
- Tests : unit (DSL union, compile avec image var), integration (édition action + tenant), worker (render image var resolution + edit image-to-image), e2e (template avec image var attaché à un post ; édition IA depuis galerie).

**Hors scope (UX globale à revoir plus tard) :**

- Autres points d'entrée d'édition IA (depuis le visuel attaché à un post, etc.) — gallery-only pour l'instant, extensible.
- Recadrage / crop, variations, retouche par masque (inpainting).
- Multi-images avancé (galerie de sélection multiple en une fois).
- Variables `color` / `list` / `toggle`.
- Migration vers MinIO en CI pour supprimer totalement Filesystem (option future si on veut zéro Filesystem).

## Décisions cadres (validées en brainstorm)

| Décision | Choix |
|---|---|
| Découpage | Un seul spec (A + B ensemble) |
| Entrée édition IA | Galerie uniquement (extensible plus tard) |
| Injection image dans le rendu | URL signée R2 (Puppeteer fetch direct), **pas** de data URL ni de bytes en DB |
| Storage dev + prod | R2 (parité prod ; le dev a les env R2). Pollution évitée par un **bucket R2 dédié dev** (env `R2_BUCKET`) |
| Storage tests | InMemory (unit/integration/worker) ; Filesystem **uniquement** E2E (multi-process, pas de secret R2 en CI) |
| Valeur d'une var image | un `mediaId` (référence à une image standalone de la galerie) |

## Partie A — Variables image dans les templates

### DSL (union discriminée)

`src/lib/visual-templates/dsl.ts` :

```ts
const stringSpec = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'invalid identifier'),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('string'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive(),
  optional: z.boolean().optional(),
});

const imageSpec = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'invalid identifier'),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('image'),
  optional: z.boolean().optional(),
});

const variableSpecSchema = z.discriminatedUnion('type', [stringSpec, imageSpec]);
export type VariableSpec = z.infer<typeof variableSpecSchema>;
export type StringVariableSpec = z.infer<typeof stringSpec>;
export type ImageVariableSpec = z.infer<typeof imageSpec>;
```

`variablesSchemaToZod` :

```ts
for (const v of schema) {
  if (v.type === 'string') {
    let s = z.string().trim();
    if (v.min !== undefined) s = s.min(v.min);
    s = s.max(v.max);
    shape[v.name] = v.optional ? s.optional() : s;
  } else {
    // image : la valeur est un mediaId (string non vide si requis).
    const s = z.string();
    shape[v.name] = v.optional ? s.optional() : s.min(1);
  }
}
```

`parseVariablesSchema` reste `variablesSchemaMeta.parse(raw)` (le méta-schéma est maintenant l'array de l'union ; le check de doublons de `name` est conservé).

### Éditeur back-office

`VariablesSchemaEditor` : ajout d'un `<Select>` `type` (texte | image) par variable. Quand `type === 'image'`, on masque `min`/`max` (non pertinents) ; on garde `name`, `label`, `description`, `optional`. La sérialisation JSON inclut `type`.

### Rendu : résolution des variables image

Le compile reste agnostique : il interpole les valeurs reçues dans le contexte. Le **worker render-visual** résout les variables image **avant** le compile :

```ts
// après: const validated = variablesSchemaToZod(schema).parse(vars)
const context: Record<string, unknown> = { ...validated };
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e5e5"/></svg>');

for (const spec of schema) {
  if (spec.type !== 'image') continue;
  const mediaId = typeof validated[spec.name] === 'string' ? (validated[spec.name] as string) : '';
  if (mediaId) {
    const m = await getMedia(userId, mediaId);
    if (m) {
      context[spec.name] = await deps.storage.signedUrl({ key: m.assetKey, expiresInSeconds: 3600 });
      continue;
    }
  }
  // preview sans image réelle, ou mediaId introuvable → placeholder pour voir la mise en page
  context[spec.name] = mode === 'preview' ? PLACEHOLDER : '';
}

const html = compileTemplate({ template, vars: context, brand });
```

Le template écrit `<img src="{{photo}}">` ou `style="background-image:url('{{photo}}')"`. Les URL R2 signées et le placeholder data-URL ne contiennent aucun caractère HTML-spécial problématique en double-stash (base64/URL safe). **Puppeteer charge l'image depuis R2** pendant le rendu ; `waitUntil: 'load'` (déjà en place) attend le chargement des images avant le screenshot.

Le `image_assets.vars` stocké garde les **mediaId** (pas les URL), pour la reproductibilité.

### Formulaire de vars du post (`VariablesForm`)

Props enrichis : `galleryImages: { mediaId; signedUrl }[]` et `styles: { id; name }[]` (pour le bouton Ajouter). Pour chaque variable :

- `type === 'string'` → champ texte (inchangé).
- `type === 'image'` → **image input** :
  - Vignette de l'image sélectionnée (si `vars[name]` est un mediaId présent dans `galleryImages`).
  - Grille cliquable des images de la galerie → sélectionner met `vars[name] = mediaId`.
  - Bouton « Ajouter (upload/IA) » → ouvre `AddImageDialog` (sans `postId`, crée juste une image standalone) → `onDone` : `router.refresh()` recharge la page post (et donc `galleryImages`), la nouvelle image apparait dans la grille.

(UX volontairement minimale — sera revue plus tard. L'important : on peut fournir une image par variable.)

`onChange` continue de remonter `vars` (les valeurs image étant des mediaId).

### Preview back-office

Le bouton « Prévisualiser » du back-office enqueue un render `mode: 'preview'` avec `sample_vars`. Pour les variables image sans mediaId valide dans `sample_vars`, le worker injecte le **placeholder** → l'auteur voit la mise en page sans devoir connaître un mediaId réel.

## Partie B — Édition IA (image-to-image)

### Provider Gemini

`src/lib/ai/generate-image.ts` :

```ts
export type EditImageFn = (opts: {
  imageBytes: Buffer;
  mimeType: string;
  prompt: string;
}) => Promise<Buffer>;

export const editImage: EditImageFn = async ({ imageBytes, mimeType, prompt }) => {
  const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
  const response = await gemini.models.generateContent({
    model: MODEL, // gemini-3-pro-image-preview (déduit l'aspect ratio de la source)
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBytes.toString('base64') } },
          { text: prompt },
        ],
      },
    ],
  } as Parameters<typeof gemini.models.generateContent>[0]);
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error('Gemini: aucune image éditée dans la réponse');
  return Buffer.from(imagePart.inlineData.data, 'base64');
};

export const editImageStub: EditImageFn = async () => STUB_PNG;
```

### Worker generate-image

`GenerateImageJob` gagne `sourceMediaId?: string`. `aspectRatio` devient optionnel (non utilisé en édition). Deps gagnent `editImage: EditImageFn`.

```ts
let png: Buffer;
let aiSourceKey: string | null = null;
if (sourceMediaId) {
  const source = await getMedia(userId, sourceMediaId);
  if (!source) throw new Error(`source media ${sourceMediaId} not found`);
  const bytes = await deps.storage.download(source.assetKey);
  const mimeType = mimeFromKey(source.assetKey); // png/jpg/webp → image/*
  png = await deps.editImage({ imageBytes: bytes, mimeType, prompt });
  aiSourceKey = source.assetKey;
} else {
  png = await deps.generateImage({ prompt, aspectRatio: aspectRatio ?? '1:1', stylePrompt });
}
// upload + createMedia + createImageAsset(source='standalone', aiBrief=prompt, styleId?, aiSourceKey)
```

`mimeFromKey` : helper partagé (réutilise la table extension→mime de la route `/api/storage`, factorisée dans `src/lib/media/mime.ts`).

L'image éditée est une **nouvelle** image standalone (`aiBrief = prompt`, `aiSourceKey = clé source`). L'originale n'est pas modifiée.

### Sélection stub worker

`src/worker/index.ts` : `editImageFn = env.CONTENT_OS_GEMINI_STUB === '1' ? editImageStub : editImage`, injecté dans `makeProcessGenerateImage`.

### Action + UI galerie

`src/app/(app)/media/actions.ts` :

```ts
export async function enqueueEditImageAction(input: {
  mediaId: string;
  prompt: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  if (!input.prompt.trim()) return { status: 'error', message: 'Prompt requis' };
  const m = await getMedia(userId, input.mediaId);
  if (!m) return { status: 'error', message: 'Image introuvable' };
  const jobKey = randomUUID();
  await enqueueGenerateImage({ userId, prompt: input.prompt.trim(), sourceMediaId: input.mediaId, jobKey });
  return { status: 'success', jobKey };
}
```

`ImageCard` : bouton « Éditer avec l'IA » → mini-dialog (textarea prompt) → `enqueueEditImageAction` → `useJobPolling(jobKey, { queue: 'generate-image' })` → on completed : toast + `router.refresh()` (la nouvelle image apparait dans la galerie).

## Storage : simplification R2

### `getStorage()` (`src/lib/storage/index.ts`)

```ts
export function getStorage(): Storage {
  if (instance) return instance;
  if (env.E2E_TESTING === 'true') {
    instance = new FilesystemStorage(); // E2E multi-process, pas de secret R2 en CI
  } else if (env.NODE_ENV === 'test') {
    instance = new InMemoryStorage();   // unit/integration/worker, hermétique
  } else if (env.R2_ACCOUNT_ID) {
    instance = new R2Storage(env.R2_BUCKET!, {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  } else {
    throw new Error('Storage R2 requis hors tests : configure R2_ACCOUNT_ID/R2_BUCKET/... ou lance les tests.');
  }
  return instance;
}
```

La branche « dev sans R2 → Filesystem » est **retirée** : en dev, on utilise R2 (le `.env` local pointe sur un **bucket dédié dev** pour ne pas polluer la prod). `FilesystemStorage` et la route `/api/storage/[...key]` restent en place mais ne servent qu'en E2E.

### Interface `Storage` : ajout `download`

`src/lib/storage/types.ts` :

```ts
download(key: string): Promise<Buffer>;
```

- **R2** : `GetObject` → concat du stream en Buffer.
- **InMemory** : retourne le buffer stocké (throw si absent).
- **Filesystem** : `readFile` (déjà un `read` ; renommer/alias en `download`).

`download` est utilisé par l'édition IA (Gemini a besoin des bytes source). Le rendu d'images-dans-templates n'utilise PAS `download` (il passe par `signedUrl` → Puppeteer fetch).

## Tests

### Unit (`vitest --project=unit`)

- `visual-templates-dsl.test.ts` (étendu) : parse d'un schéma avec var `image` ; `variablesSchemaToZod` accepte un mediaId pour image, refuse vide si requis, accepte absent si optional.
- `visual-templates-compile.test.ts` (étendu) : `<img src="{{photo}}">` interpole une URL passée en contexte (le compile ne fait que l'interpolation).

### Integration (`vitest --project=integration`)

- `media-actions.test.ts` (étendu) : `enqueueEditImageAction` — on teste **uniquement les chemins d'erreur** (prompt vide, image d'un autre user), qui retournent `{ status: 'error' }` **avant** d'atteindre `enqueueGenerateImage` (donc pas de Redis requis). Le chemin succès (qui enqueue) est couvert indirectement par l'E2E.
- `visual-template-create-action.test.ts` (étendu) : un template avec une variable `image` valide est accepté ; `sample_vars` pour une var image (mediaId string) validé.

### Worker (`vitest --project=worker`)

- `render-visual.test.ts` (étendu) : un template avec var image + un mediaId réel → le worker appelle `signedUrl` pour cette clé et le HTML compilé contient l'URL ; en `mode=preview` sans mediaId → placeholder injecté (HTML contient le data URL placeholder). Mock `renderHtmlToPng` (capture le `html` reçu pour assertion).
- `generate-image.test.ts` (étendu) : avec `sourceMediaId` → `editImage` appelé avec les bytes téléchargés (mock `download` via InMemory), nouvelle image standalone créée avec `aiSourceKey` = clé source ; sans `sourceMediaId` → `generateImage` (inchangé).

### E2E Playwright (`test:e2e`)

- `template-image-var.spec.ts` : créer un template avec une var image (HTML `<img src="{{photo}}">`) → sur un post, « Ajouter un visuel » → Template → remplir la var image en choisissant une image de la galerie (préalablement générée via IA stub) → Aperçu → Valider → visuel attaché. (Rendu stubbé : on vérifie le flux + l'attache, pas les pixels.)
- `image-edit.spec.ts` : galerie → générer une image (stub) → « Éditer avec l'IA » → prompt → polling → une 2e image apparait dans la galerie.
- Stubs : `CONTENT_OS_GEMINI_STUB=1` (couvre `editImage` aussi), `CONTENT_OS_PUPPETEER_STUB=1`, `E2E_TESTING=true` (Filesystem partagé).

## Décisions techniques tranchées

- **Var image = `mediaId`** (référence galerie), pas des bytes ni un upload inline dans le formulaire de template. L'ajout d'image passe par le module Spec 6 (`AddImageDialog`), réutilisé.
- **Rendu via URL signée R2** (Puppeteer fetch direct), pas de data URL : plus propre, pas de bytes en transit inutiles, et ça impose R2 en dev (parité). Placeholder preview = petit SVG data URL inline (constante statique, pas de bytes réels).
- **R2 en dev + prod** ; Filesystem cantonné à l'E2E. Bucket dev dédié via `R2_BUCKET` pour isoler de la prod.
- **`download` sur l'interface Storage** : nécessaire pour l'édition IA (bytes source → Gemini). R2 `GetObject`.
- **Édition = nouvelle image** (immutable source) : `aiSourceKey` trace la provenance, prêt pour un historique/variantes plus tard.
- **Réutilisation de la queue `generate-image`** pour l'édition (même sortie : une image standalone). Discriminé par `sourceMediaId`.

## Migration & déploiement

1. Pas de migration DB (le schéma `image_assets` a déjà `aiSourceKey`, `source`, `aiBrief`, `styleId`).
2. **Dev** : `.env` doit avoir `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` (bucket dédié dev recommandé). Sans R2 hors tests, le boot throw avec un message clair.
3. CI : E2E continue avec `E2E_TESTING=1` (Filesystem) + les 3 stubs. Pas de secret R2 requis en CI.
4. Pas de nouvelle dépendance (réutilise `@google/genai`, `image-size` n'est pas requis pour l'édition).

## Critères de réussite

- Back-office : créer un template avec une variable `image` (sélecteur type), HTML `<img src="{{photo}}">` ; preview affiche un placeholder.
- Sur un post : générer un visuel depuis ce template, fournir l'image en la choisissant dans la galerie (ou en l'ajoutant via upload/IA) ; le PNG rendu contient l'image (chargée depuis R2).
- Galerie : « Éditer avec l'IA » sur une image → prompt → nouvelle image éditée dans la galerie (originale conservée, `aiSourceKey` renseigné).
- Storage : dev local utilise R2 ; `npm test` (unit/integration/worker) en InMemory ; E2E en Filesystem. Tout vert.
- Tenant isolation préservée (édition/var image scopées user). Lint + tsc clean. CI verte.

## Hors-scope rappelé

- Édition IA depuis d'autres points d'entrée que la galerie (extensible).
- Crop / inpainting / variations / historique d'édition.
- Variables `color` / `list` / `toggle`.
- Sélection multiple d'images en une fois.
- Suppression de Filesystem via MinIO en CI.
