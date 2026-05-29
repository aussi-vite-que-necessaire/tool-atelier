# Spec 6 (Image library) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de créer des images standalone (upload OU génération IA Gemini), les voir dans une galerie `/media`, et les attacher à un post (upload / IA / réutilisation galerie) en plus de l'option template existante.

**Architecture:** Réutilise le schéma `media` + `image_assets` (source='standalone') et `visual_styles` (zéro migration). Upload = Server Action synchrone (validation + `image-size` + storage + DB). Génération IA = queue BullMQ `generate-image` + worker appelant Gemini `gemini-3-pro-image-preview`. Galerie + module `<AddImageDialog>` réutilisé par la galerie et le post picker (extension de l'`AddVisualDialog` de Spec 5).

**Tech Stack:** Drizzle/Postgres, BullMQ/Redis, Cloudflare R2 + FilesystemStorage (Spec 5), `@google/genai`, `image-size`, Next.js 16 App Router + React 19 (Server Actions + `useActionState` + `useJobPolling`), shadcn/ui, Vitest, Playwright.

**Référence spec :** `docs/superpowers/specs/2026-05-24-spec-6-image-library-design.md`

---

## File Structure

**Nouveaux fichiers source :**
- `src/lib/media/validate-upload.ts` — `validateUploadFile` (pure).
- `src/lib/ai/generate-image.ts` — `composeImagePrompt` (pure) + `generateImage` (Gemini) + `generateImageStub` + `GenerateImageFn` type + `IMAGE_ASPECT_RATIOS`.
- `src/lib/media/upload-core.ts` — `uploadImageCore` (validation + storage + DB).
- `src/worker/queues/generate-image.ts` — worker BullMQ.
- `src/components/media/add-image-dialog.tsx` — module Upload | Générer IA (Client).
- `src/app/(app)/media/page.tsx` — galerie.
- `src/app/(app)/media/_components/image-card.tsx` — vignette + suppression (Client).
- `src/app/(app)/media/actions.ts` — `uploadImageAction`, `enqueueGenerateImageAction`, `deleteImageAction`.
- `src/app/(app)/media/actions-core.ts` — cœurs testables des actions galerie.

**Fichiers modifiés :**
- `package.json` — deps `@google/genai`, `image-size`.
- `src/lib/env.ts` — `GEMINI_API_KEY`, `CONTENT_OS_GEMINI_STUB`.
- `.env.example` — idem.
- `src/lib/db/repositories/image-assets.ts` — `listStandaloneImages`, `countPostsUsingMedia`.
- `src/lib/queue/client.ts` — `GenerateImageJob`, `GenerateImageResult`, `generateImageQueue`.
- `src/lib/queue/enqueue.ts` — `enqueueGenerateImage`.
- `src/lib/queue/registry.ts` — register `generate-image`.
- `src/worker/index.ts` — register worker + stub selection.
- `src/components/layout/app-header.tsx` — lien nav "Galerie".
- `src/app/(app)/posts/[id]/media-actions.ts` — `attachExistingMediaAction`.
- `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` — options Upload / IA / Galerie.
- `test/e2e/global-setup.ts` — propage `CONTENT_OS_GEMINI_STUB=1`.

**Nouveaux tests :**
- `test/unit/validate-upload.test.ts`
- `test/unit/compose-image-prompt.test.ts`
- `test/integration/upload-image.test.ts`
- `test/integration/standalone-images-repository.test.ts`
- `test/integration/media-actions.test.ts` (attach existing, delete)
- `test/worker/generate-image.test.ts`
- `test/e2e/media-gallery.spec.ts`
- `test/e2e/post-image.spec.ts`

---

## Task 1: Deps + env + repository queries

**Files:**
- Modify: `package.json`, `src/lib/env.ts`, `.env.example`, `src/lib/db/repositories/image-assets.ts`
- Test: `test/integration/standalone-images-repository.test.ts`

- [ ] **Step 1: Install deps**

```bash
npm install @google/genai image-size
```

- [ ] **Step 2: Env vars**

`src/lib/env.ts` — ajouter dans `envSchema` après `CONTENT_OS_PUPPETEER_STUB` :

```ts
  GEMINI_API_KEY: z.string().optional(),
  CONTENT_OS_GEMINI_STUB: z.enum(['0', '1']).default('0'),
```

`.env.example` — ajouter à la fin :

```
# Gemini (génération d'image). Laisse vide si CONTENT_OS_GEMINI_STUB=1.
GEMINI_API_KEY=

# Renderer/IA image stub : si "1", génération d'image renvoie un PNG 1x1
# sans appeler Gemini. Utilisé en CI et tests E2E.
CONTENT_OS_GEMINI_STUB=0
```

- [ ] **Step 3: Write repository tests (TDD)**

Créer `test/integration/standalone-images-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { createImageAsset, listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { createTestUser } from './helpers/seed';

async function makeStandalone(userId: string, aiBrief: string | null = null) {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: `k-${Math.random()}`,
    previewKey: 'k',
    width: 100,
    height: 100,
  });
  await createImageAsset(userId, { mediaId: m.id, source: 'standalone', aiBrief });
  return m;
}

describe('listStandaloneImages', () => {
  test('ne renvoie que les images standalone du bon user', async () => {
    const a = await createTestUser('si-a');
    const b = await createTestUser('si-b');
    await makeStandalone(a, 'prompt A');
    await makeStandalone(b, 'prompt B');
    // un media template-source ne doit PAS apparaitre
    const tmplMedia = await createMedia(a, {
      kind: 'image',
      assetKey: 'tmpl',
      previewKey: 'tmpl',
      width: 1,
      height: 1,
    });
    await createImageAsset(a, { mediaId: tmplMedia.id, source: 'template', templateSlug: 'x' });

    const listA = await listStandaloneImages(a);
    expect(listA).toHaveLength(1);
    expect(listA[0]!.asset.source).toBe('standalone');
    expect(listA[0]!.asset.aiBrief).toBe('prompt A');
    expect(await listStandaloneImages(b)).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run (expected FAIL)**

```bash
npm run test:integration -- standalone-images-repository
```

- [ ] **Step 5: Implement repository functions**

`src/lib/db/repositories/image-assets.ts` — ajouter en haut les imports manquants et en bas les fonctions :

```ts
// imports : ajouter `desc` à drizzle-orm, et `type Media, media` au schema
// (and/eq/inArray + imageAssets/ImageAsset existent déjà dans ce fichier).
import { and, desc, eq } from 'drizzle-orm';
import { type ImageAsset, imageAssets, type Media, media } from '../schema';

// ... (garder l'existant)

export type StandaloneImage = { media: Media; asset: ImageAsset };

export async function listStandaloneImages(userId: string): Promise<StandaloneImage[]> {
  const rows = await db
    .select({ media, asset: imageAssets })
    .from(imageAssets)
    .innerJoin(media, eq(imageAssets.mediaId, media.id))
    .where(and(eq(media.userId, userId), eq(imageAssets.source, 'standalone')))
    .orderBy(desc(media.createdAt));
  return rows.map((r) => ({ media: r.media, asset: r.asset }));
}
```

(Note : ajouter `desc` à l'import `drizzle-orm` et `type Media, media` à l'import `../schema` si absents. Ne pas ajouter `count`/`posts` — non utilisés ici.)

- [ ] **Step 6: Run (expected PASS)**

```bash
npm run test:integration -- standalone-images-repository
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/env.ts .env.example \
  src/lib/db/repositories/image-assets.ts test/integration/standalone-images-repository.test.ts
git commit -m "🤖 feat(spec-6): deps gemini/image-size + env + repo listStandaloneImages"
```

---

## Task 2: Upload validation (pure) + unit test

**Files:**
- Create: `src/lib/media/validate-upload.ts`, `test/unit/validate-upload.test.ts`

- [ ] **Step 1: Write test (TDD)**

`test/unit/validate-upload.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { validateUploadFile } from '@/lib/media/validate-upload';

describe('validateUploadFile', () => {
  test('accepte png/jpg/webp', () => {
    expect(validateUploadFile({ type: 'image/png', size: 100 })).toEqual({ ok: true, ext: 'png' });
    expect(validateUploadFile({ type: 'image/jpeg', size: 100 })).toEqual({ ok: true, ext: 'jpg' });
    expect(validateUploadFile({ type: 'image/webp', size: 100 })).toEqual({ ok: true, ext: 'webp' });
  });

  test('rejette un format non supporté', () => {
    const r = validateUploadFile({ type: 'image/gif', size: 100 });
    expect(r.ok).toBe(false);
  });

  test('rejette > 10 Mo', () => {
    const r = validateUploadFile({ type: 'image/png', size: 11 * 1024 * 1024 });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:unit -- validate-upload
```

- [ ] **Step 3: Implement**

`src/lib/media/validate-upload.ts` :

```ts
const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

const MAX_BYTES = 10 * 1024 * 1024;

export type UploadExt = (typeof ALLOWED)[keyof typeof ALLOWED];

export function validateUploadFile(
  file: { type: string; size: number },
): { ok: true; ext: UploadExt } | { ok: false; message: string } {
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext) return { ok: false, message: 'Format non supporté (png, jpg, webp).' };
  if (file.size > MAX_BYTES) return { ok: false, message: 'Image trop lourde (max 10 Mo).' };
  return { ok: true, ext };
}
```

- [ ] **Step 4: Run (expected PASS)**

```bash
npm run test:unit -- validate-upload
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/media/validate-upload.ts test/unit/validate-upload.test.ts
git commit -m "🤖 feat(spec-6): validateUploadFile (format/taille)"
```

---

## Task 3: Gemini provider + prompt composition + stub

**Files:**
- Create: `src/lib/ai/generate-image.ts`, `test/unit/compose-image-prompt.test.ts`

- [ ] **Step 1: Write test (TDD)**

`test/unit/compose-image-prompt.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { composeImagePrompt, IMAGE_ASPECT_RATIOS } from '@/lib/ai/generate-image';

describe('composeImagePrompt', () => {
  test('prompt seul', () => {
    expect(composeImagePrompt('un chat')).toBe('un chat');
  });
  test('prompt + style', () => {
    expect(composeImagePrompt('un chat', 'flat design minimaliste')).toBe(
      'un chat\n\nStyle : flat design minimaliste',
    );
  });
  test('style null/vide ignoré', () => {
    expect(composeImagePrompt('un chat', null)).toBe('un chat');
    expect(composeImagePrompt('un chat', '')).toBe('un chat');
  });
});

describe('IMAGE_ASPECT_RATIOS', () => {
  test('expose les ratios LinkedIn', () => {
    expect(IMAGE_ASPECT_RATIOS).toEqual(['1:1', '4:5', '16:9']);
  });
});
```

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:unit -- compose-image-prompt
```

- [ ] **Step 3: Implement**

`src/lib/ai/generate-image.ts` :

```ts
import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';

const MODEL = 'gemini-3-pro-image-preview';

export const IMAGE_ASPECT_RATIOS = ['1:1', '4:5', '16:9'] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

export type GenerateImageFn = (opts: {
  prompt: string;
  aspectRatio: string;
  stylePrompt?: string | null;
}) => Promise<Buffer>;

export function composeImagePrompt(prompt: string, stylePrompt?: string | null): string {
  const s = stylePrompt?.trim();
  return s ? `${prompt}\n\nStyle : ${s}` : prompt;
}

// 1×1 transparent PNG, identique à render.ts.
const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const generateImageStub: GenerateImageFn = async () => STUB_PNG;

export const generateImage: GenerateImageFn = async ({ prompt, aspectRatio, stylePrompt }) => {
  const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
  const fullPrompt = composeImagePrompt(prompt, stylePrompt);
  const response = await gemini.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    config: { imageConfig: { aspectRatio } },
  } as Parameters<typeof gemini.models.generateContent>[0]);
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini: aucune image dans la réponse');
  }
  return Buffer.from(imagePart.inlineData.data, 'base64');
};
```

- [ ] **Step 4: Run (expected PASS)**

```bash
npm run test:unit -- compose-image-prompt
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/generate-image.ts test/unit/compose-image-prompt.test.ts
git commit -m "🤖 feat(spec-6): provider Gemini generateImage + stub + composeImagePrompt"
```

---

## Task 4: Upload core + Server Action + integration test

**Files:**
- Create: `src/lib/media/upload-core.ts`, `src/app/(app)/media/actions.ts`, `test/integration/upload-image.test.ts`

- [ ] **Step 1: Write test (TDD)**

`test/integration/upload-image.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { uploadImageCore } from '@/lib/media/upload-core';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers/seed';

// PNG 1x1 réel (décodable par image-size).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function makeFile(type: string, bytes: Buffer): File {
  return new File([bytes], 'test', { type });
}

describe('uploadImageCore', () => {
  test('crée une image standalone à partir d\'un PNG', async () => {
    const userId = await createTestUser('up-ok');
    const r = await uploadImageCore(userId, makeFile('image/png', PNG_1x1));
    expect(r.status).toBe('success');
    const list = await listStandaloneImages(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.asset.source).toBe('standalone');
    expect(list[0]!.asset.aiBrief).toBeNull();
  });

  test('rejette un format non supporté', async () => {
    const userId = await createTestUser('up-bad');
    const r = await uploadImageCore(userId, makeFile('image/gif', PNG_1x1));
    expect(r.status).toBe('error');
  });

  test('attache au post si postId fourni', async () => {
    const userId = await createTestUser('up-post');
    const idea = await createIdea(userId, { idea: 'I' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    const r = await uploadImageCore(userId, makeFile('image/png', PNG_1x1), { postId: post.id });
    expect(r.status).toBe('success');
    if (r.status !== 'success') throw new Error();
    expect((await getPost(userId, post.id))?.mediaId).toBe(r.mediaId);
  });
});
```

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:integration -- upload-image
```

- [ ] **Step 3: Implement core**

`src/lib/media/upload-core.ts` :

```ts
import { imageSize } from 'image-size';
import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { updatePost } from '@/lib/db/repositories/posts';
import { getStorage } from '@/lib/storage';
import { validateUploadFile } from './validate-upload';

export async function uploadImageCore(
  userId: string,
  file: File,
  opts: { postId?: string } = {},
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const v = validateUploadFile({ type: file.type, size: file.size });
  if (!v.ok) return { status: 'error', message: v.message };

  const bytes = Buffer.from(await file.arrayBuffer());
  const dims = imageSize(bytes);
  if (!dims.width || !dims.height) return { status: 'error', message: 'Image illisible.' };

  const mediaId = createId();
  const assetKey = `media/${userId}/${mediaId}.${v.ext}`;
  await getStorage().upload({ key: assetKey, body: bytes, contentType: file.type });
  await createMedia(
    userId,
    { kind: 'image', assetKey, previewKey: assetKey, width: dims.width, height: dims.height },
    mediaId,
  );
  await createImageAsset(userId, { mediaId, source: 'standalone' });

  if (opts.postId) await updatePost(userId, opts.postId, { mediaId });
  return { status: 'success', mediaId };
}
```

- [ ] **Step 4: Run (expected PASS)**

```bash
npm run test:integration -- upload-image
```

- [ ] **Step 5: Create Server Action**

`src/app/(app)/media/actions.ts` (les autres actions s'ajoutent en Task 7) :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { uploadImageCore } from '@/lib/media/upload-core';

export async function uploadImageAction(
  formData: FormData,
): Promise<{ status: 'success'; mediaId: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const file = formData.get('file');
  if (!(file instanceof File)) return { status: 'error', message: 'Fichier manquant.' };
  const postId = formData.get('postId');
  const result = await uploadImageCore(userId, file, {
    postId: typeof postId === 'string' && postId.length > 0 ? postId : undefined,
  });
  if (result.status === 'success') {
    revalidatePath('/media');
    if (typeof postId === 'string' && postId.length > 0) revalidatePath(`/posts/${postId}`);
  }
  return result;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/media/upload-core.ts src/app/\(app\)/media/actions.ts test/integration/upload-image.test.ts
git commit -m "🤖 feat(spec-6): upload image (core + Server Action) + tests"
```

---

## Task 5: Queue generate-image + worker + worker test

**Files:**
- Modify: `src/lib/queue/client.ts`, `src/lib/queue/enqueue.ts`, `src/lib/queue/registry.ts`, `src/worker/index.ts`
- Create: `src/worker/queues/generate-image.ts`, `test/worker/generate-image.test.ts`

- [ ] **Step 1: Queue types + queue**

`src/lib/queue/client.ts` — ajouter en bas :

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

export const generateImageQueue = new Queue<GenerateImageJob, GenerateImageResult>(
  'generate-image',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);
```

- [ ] **Step 2: enqueue + registry**

`src/lib/queue/enqueue.ts` — ajouter l'import `GenerateImageJob, generateImageQueue` et :

```ts
export async function enqueueGenerateImage(payload: GenerateImageJob): Promise<string> {
  const job = await generateImageQueue.add('generate', payload, { jobId: payload.jobKey });
  return job.id!;
}
```

`src/lib/queue/registry.ts` — ajouter `generateImageQueue` à l'import et `'generate-image': generateImageQueue` au registry.

- [ ] **Step 3: Write worker test (TDD)**

`test/worker/generate-image.test.ts` :

```ts
import type { Job } from 'bullmq';
import { describe, expect, test, vi } from 'vitest';
import { createIdea } from '@/lib/db/repositories/ideas';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { GenerateImageJob } from '@/lib/queue/client';
import { InMemoryStorage } from '@/lib/storage/in-memory';
import { makeProcessGenerateImage } from '@/worker/queues/generate-image';
import { createTestUser } from '../integration/helpers/seed';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function makeJob(data: GenerateImageJob): Job<GenerateImageJob> {
  return { data } as unknown as Job<GenerateImageJob>;
}

describe('processGenerateImage', () => {
  test('crée une image standalone avec aiBrief', async () => {
    const userId = await createTestUser('gi-ok');
    const storage = new InMemoryStorage();
    const genFn = vi.fn().mockResolvedValue(PNG_1x1);
    const handler = makeProcessGenerateImage({ storage, generateImage: genFn });

    const res = await handler(
      makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', jobKey: 'g1' }),
    );
    expect(res.mediaId).toBeDefined();
    expect(res.signedUrl).toMatch(/^http|^\/api\/storage/);
    const list = await listStandaloneImages(userId);
    expect(list).toHaveLength(1);
    expect(list[0]!.asset.aiBrief).toBe('un chat');
    expect(genFn).toHaveBeenCalledOnce();
  });

  test('charge le style si styleId fourni', async () => {
    const userId = await createTestUser('gi-style');
    const style = await createVisualStyle(userId, { name: 'Flat', prompt: 'flat design' });
    const storage = new InMemoryStorage();
    const genFn = vi.fn().mockResolvedValue(PNG_1x1);
    const handler = makeProcessGenerateImage({ storage, generateImage: genFn });

    await handler(
      makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', styleId: style!.id, jobKey: 'g2' }),
    );
    expect(genFn).toHaveBeenCalledWith(
      expect.objectContaining({ stylePrompt: 'flat design' }),
    );
  });

  test('attache au post si postId fourni', async () => {
    const userId = await createTestUser('gi-post');
    const idea = await createIdea(userId, { idea: 'I' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    const storage = new InMemoryStorage();
    const genFn = vi.fn().mockResolvedValue(PNG_1x1);
    const handler = makeProcessGenerateImage({ storage, generateImage: genFn });

    const res = await handler(
      makeJob({ userId, prompt: 'x', aspectRatio: '1:1', postId: post.id, jobKey: 'g3' }),
    );
    expect((await getPost(userId, post.id))?.mediaId).toBe(res.mediaId);
  });
});
```

- [ ] **Step 4: Run (expected FAIL)**

```bash
npm run test:worker -- generate-image
```

- [ ] **Step 5: Implement worker**

`src/worker/queues/generate-image.ts` :

```ts
import type { Job } from 'bullmq';
import { imageSize } from 'image-size';
import type { GenerateImageFn } from '@/lib/ai/generate-image';
import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getVisualStyle } from '@/lib/db/repositories/visual-styles';
import type { GenerateImageJob, GenerateImageResult } from '@/lib/queue/client';
import type { Storage } from '@/lib/storage';

type Deps = { storage: Storage; generateImage: GenerateImageFn };

export function makeProcessGenerateImage(deps: Deps) {
  return async function processGenerateImage(
    job: Job<GenerateImageJob>,
  ): Promise<GenerateImageResult> {
    const { userId, prompt, aspectRatio, styleId, postId } = job.data;

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
    await createMedia(
      userId,
      {
        kind: 'image',
        assetKey,
        previewKey: assetKey,
        width: dims.width ?? 1024,
        height: dims.height ?? 1024,
      },
      mediaId,
    );
    await createImageAsset(userId, {
      mediaId,
      source: 'standalone',
      aiBrief: prompt,
      styleId: styleId ?? null,
    });

    if (postId) {
      const post = await getPost(userId, postId);
      if (post) await updatePost(userId, postId, { mediaId });
    }

    const signedUrl = await deps.storage.signedUrl({ key: assetKey, expiresInSeconds: 3600 });
    return { mediaId, signedUrl, width: dims.width ?? 1024, height: dims.height ?? 1024 };
  };
}
```

- [ ] **Step 6: Run (expected PASS)**

```bash
npm run test:worker -- generate-image
```

- [ ] **Step 7: Register worker in `src/worker/index.ts`**

Ajouter les imports :

```ts
import { generateImage, generateImageStub } from '@/lib/ai/generate-image';
import { makeProcessGenerateImage } from './queues/generate-image';
```

Sélection stub (après les autres) :

```ts
const generateImageFn = env.CONTENT_OS_GEMINI_STUB === '1' ? generateImageStub : generateImage;
if (env.CONTENT_OS_GEMINI_STUB === '1') {
  console.log('[worker] CONTENT_OS_GEMINI_STUB=1 active : Gemini NOT called.');
}
```

Ajouter au tableau `workers` :

```ts
  new Worker('generate-image', makeProcessGenerateImage({ storage: getStorage(), generateImage: generateImageFn }), {
    connection,
    concurrency: 2,
  }),
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/queue/client.ts src/lib/queue/enqueue.ts src/lib/queue/registry.ts \
  src/worker/queues/generate-image.ts src/worker/index.ts test/worker/generate-image.test.ts
git commit -m "🤖 feat(spec-6): queue generate-image + worker Gemini + stub"
```

---

## Task 6: Gallery actions (enqueue gen, delete) + integration tests

**Files:**
- Create: `src/app/(app)/media/actions-core.ts`, `test/integration/media-actions.test.ts`
- Modify: `src/app/(app)/media/actions.ts`, `src/app/(app)/posts/[id]/media-actions.ts`

- [ ] **Step 1: Write integration test (TDD)**

`test/integration/media-actions.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { deleteImageCore } from '@/app/(app)/media/actions-core';
import { attachExistingMediaCore } from '@/app/(app)/posts/[id]/media-actions';
import { createImageAsset, getImageAsset } from '@/lib/db/repositories/image-assets';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createMedia, getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers/seed';

async function makeStandalone(userId: string) {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: `k-${Math.random()}`,
    previewKey: 'k',
    width: 10,
    height: 10,
  });
  await createImageAsset(userId, { mediaId: m.id, source: 'standalone' });
  return m;
}

describe('attachExistingMediaCore', () => {
  test('attache un media de la galerie au post', async () => {
    const userId = await createTestUser('aem-ok');
    const m = await makeStandalone(userId);
    const idea = await createIdea(userId, { idea: 'I' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    const r = await attachExistingMediaCore(userId, post.id, m.id);
    expect(r.status).toBe('success');
    expect((await getPost(userId, post.id))?.mediaId).toBe(m.id);
  });

  test('refuse un media d\'un autre user', async () => {
    const a = await createTestUser('aem-a');
    const b = await createTestUser('aem-b');
    const m = await makeStandalone(a);
    const idea = await createIdea(b, { idea: 'I' });
    const post = await createPost(b, { ideaId: idea.id, content: 'c' });
    const r = await attachExistingMediaCore(b, post.id, m.id);
    expect(r.status).toBe('error');
  });
});

describe('deleteImageCore', () => {
  test('supprime le media ; les posts référents passent à media_id null', async () => {
    const userId = await createTestUser('di-ok');
    const m = await makeStandalone(userId);
    const idea = await createIdea(userId, { idea: 'I' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c', mediaId: m.id });
    const r = await deleteImageCore(userId, m.id);
    expect(r.status).toBe('success');
    expect(await getMedia(userId, m.id)).toBeUndefined();
    expect((await getPost(userId, post.id))?.mediaId).toBeNull();
  });
});
```

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:integration -- media-actions
```

- [ ] **Step 3: Implement `deleteImageCore` + actions**

`src/app/(app)/media/actions-core.ts` :

```ts
import { deleteMedia, getMedia } from '@/lib/db/repositories/media';

export async function deleteImageCore(
  userId: string,
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const m = await getMedia(userId, mediaId);
  if (!m) return { status: 'error', message: 'Image introuvable' };
  await deleteMedia(userId, mediaId); // cascade image_assets ; posts.media_id → null (FK SET NULL)
  return { status: 'success' };
}
```

Ajouter dans `src/app/(app)/media/actions.ts` :

```ts
import { randomUUID } from 'node:crypto';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates'; // (non, retirer si inutile)
import { enqueueGenerateImage } from '@/lib/queue/enqueue';
import { IMAGE_ASPECT_RATIOS } from '@/lib/ai/generate-image';
import { deleteImageCore } from './actions-core';

export async function enqueueGenerateImageAction(input: {
  prompt: string;
  aspectRatio: string;
  styleId?: string;
  postId?: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  if (!input.prompt.trim()) return { status: 'error', message: 'Prompt requis' };
  if (!IMAGE_ASPECT_RATIOS.includes(input.aspectRatio as (typeof IMAGE_ASPECT_RATIOS)[number])) {
    return { status: 'error', message: 'Aspect ratio invalide' };
  }
  const jobKey = randomUUID();
  await enqueueGenerateImage({
    userId,
    prompt: input.prompt.trim(),
    aspectRatio: input.aspectRatio,
    styleId: input.styleId,
    postId: input.postId,
    jobKey,
  });
  return { status: 'success', jobKey };
}

export async function deleteImageAction(
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const r = await deleteImageCore(userId, mediaId);
  if (r.status === 'success') revalidatePath('/media');
  return r;
}
```

(Nettoyer l'import `getVisualTemplate` qui n'est pas utilisé — laissé en commentaire pour rappel, à retirer.)

- [ ] **Step 4: Implement `attachExistingMediaCore` + action**

`src/app/(app)/posts/[id]/media-actions.ts` — ajouter :

```ts
import { getMedia } from '@/lib/db/repositories/media';

export async function attachExistingMediaCore(
  userId: string,
  postId: string,
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const media = await getMedia(userId, mediaId);
  if (!media) return { status: 'error', message: 'Image introuvable' };
  const post = await getPost(userId, postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  await updatePost(userId, postId, { mediaId });
  return { status: 'success' };
}

export async function attachExistingMediaAction(input: {
  postId: string;
  mediaId: string;
}): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const r = await attachExistingMediaCore(userId, input.postId, input.mediaId);
  if (r.status === 'success') revalidatePath(`/posts/${input.postId}`);
  return r;
}
```

(Vérifier que `getMedia`, `getPost`, `updatePost`, `requireUserId`, `revalidatePath` sont importés dans ce fichier — `getPost`/`updatePost`/`requireUserId`/`revalidatePath` le sont déjà depuis Spec 5 ; ajouter `getMedia`.)

- [ ] **Step 5: Run (expected PASS)**

```bash
npm run test:integration -- media-actions
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/media/actions.ts src/app/\(app\)/media/actions-core.ts \
  src/app/\(app\)/posts/\[id\]/media-actions.ts test/integration/media-actions.test.ts
git commit -m "🤖 feat(spec-6): actions enqueue-gen / delete-image / attach-existing + tests"
```

---

## Task 7: AddImageDialog (Upload | Générer IA)

**Files:**
- Create: `src/components/media/add-image-dialog.tsx`

- [ ] **Step 1: Implement the component**

`src/components/media/add-image-dialog.tsx` :

```tsx
'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IMAGE_ASPECT_RATIOS } from '@/lib/ai/generate-image';
import { useJobPolling } from '@/hooks/use-job-polling';
import { enqueueGenerateImageAction, uploadImageAction } from '@/app/(app)/media/actions';

type Style = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  styles: Style[];
  onDone?: () => void;
};

export function AddImageDialog({ open, onOpenChange, postId, styles, onDone }: Props) {
  const [tab, setTab] = useState<'upload' | 'ai'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<string>(IMAGE_ASPECT_RATIOS[0]);
  const [styleId, setStyleId] = useState<string>('');
  const [enqueuing, startEnqueue] = useTransition();
  const [jobKey, setJobKey] = useState<string | null>(null);

  useJobPolling(jobKey, {
    queue: 'generate-image',
    defaultToast: false,
    onCompleted: () => {
      toast.success('Image générée');
      setJobKey(null);
      onDone?.();
      onOpenChange(false);
    },
  });

  const onUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Choisis un fichier');
      return;
    }
    const fd = new FormData();
    fd.set('file', file);
    if (postId) fd.set('postId', postId);
    startUpload(async () => {
      const r = await uploadImageAction(fd);
      if (r.status === 'error') toast.error(r.message);
      else {
        toast.success('Image uploadée');
        onDone?.();
        onOpenChange(false);
      }
    });
  };

  const onGenerate = () => {
    startEnqueue(async () => {
      const r = await enqueueGenerateImageAction({
        prompt,
        aspectRatio: aspect,
        styleId: styleId || undefined,
        postId,
      });
      if (r.status === 'error') toast.error(r.message);
      else setJobKey(r.jobKey);
    });
  };

  const aiWorking = enqueuing || jobKey !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une image</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant={tab === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setTab('upload')}>
            Upload
          </Button>
          <Button variant={tab === 'ai' ? 'default' : 'outline'} size="sm" onClick={() => setTab('ai')}>
            Générer avec l'IA
          </Button>
        </div>

        {tab === 'upload' ? (
          <div className="space-y-3">
            <Input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" />
            <Button onClick={onUpload} disabled={uploading}>
              {uploading ? 'Upload…' : 'Uploader'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ai-prompt">Prompt</Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Format</Label>
                <Select value={aspect} onValueChange={setAspect}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Style (optionnel)</Label>
                <Select value={styleId || 'none'} onValueChange={(v) => setStyleId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={onGenerate} disabled={aiWorking || !prompt.trim()}>
              {aiWorking ? 'Génération…' : 'Générer'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur sur ce fichier (vérifier que `Select` existe dans `src/components/ui/select.tsx` — utilisé en Spec 4).

- [ ] **Step 3: Commit**

```bash
git add src/components/media/add-image-dialog.tsx
git commit -m "🤖 feat(spec-6): module AddImageDialog (Upload | Générer IA)"
```

---

## Task 8: Gallery page /media + ImageCard + nav link

**Files:**
- Create: `src/app/(app)/media/page.tsx`, `src/app/(app)/media/_components/image-card.tsx`, `src/app/(app)/media/_components/gallery-client.tsx`
- Modify: `src/components/layout/app-header.tsx`

- [ ] **Step 1: ImageCard (Client)**

`src/app/(app)/media/_components/image-card.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteImageAction } from '../actions';

type Props = {
  mediaId: string;
  signedUrl: string;
  source: string;
  aiBrief: string | null;
  createdAt: string;
};

export function ImageCard({ mediaId, signedUrl, source, aiBrief, createdAt }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const onDelete = () => {
    start(async () => {
      const r = await deleteImageAction(mediaId);
      if (r.status === 'error') toast.error(r.message);
      else toast.success('Image supprimée');
      setOpen(false);
    });
  };

  return (
    <div className="border rounded overflow-hidden bg-white">
      <div className="bg-neutral-50 aspect-square flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={signedUrl} alt={aiBrief ?? 'Image'} className="max-w-full max-h-full object-contain" />
      </div>
      <div className="p-2 space-y-1">
        <p className="text-xs text-muted-foreground">
          {source === 'standalone' && aiBrief ? 'IA' : 'Upload'} · {new Date(createdAt).toLocaleDateString('fr-FR')}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="ghost" size="sm">Supprimer</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer cette image ?</DialogTitle>
              <DialogDescription>
                Elle sera retirée de la galerie et des posts qui l'utilisent.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={pending}>
                {pending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Gallery client wrapper (bouton ajouter + dialog)**

`src/app/(app)/media/_components/gallery-client.tsx` :

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AddImageDialog } from '@/components/media/add-image-dialog';
import { Button } from '@/components/ui/button';

type Style = { id: string; name: string };

export function GalleryAddButton({ styles }: { styles: Style[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Ajouter une image</Button>
      <AddImageDialog
        open={open}
        onOpenChange={setOpen}
        styles={styles}
        onDone={() => router.refresh()}
      />
    </>
  );
}
```

- [ ] **Step 3: Gallery page (Server Component)**

`src/app/(app)/media/page.tsx` :

```tsx
import { requireUserId } from '@/lib/auth/session';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
import { getStorage } from '@/lib/storage';
import { ImageCard } from './_components/image-card';
import { GalleryAddButton } from './_components/gallery-client';

export default async function MediaGalleryPage() {
  const userId = await requireUserId();
  const [images, styles] = await Promise.all([
    listStandaloneImages(userId),
    listVisualStyles(userId),
  ]);
  const storage = getStorage();
  const withUrls = await Promise.all(
    images.map(async ({ media, asset }) => ({
      mediaId: media.id,
      source: asset.source,
      aiBrief: asset.aiBrief,
      createdAt: media.createdAt.toISOString(),
      signedUrl: await storage.signedUrl({ key: media.assetKey, expiresInSeconds: 3600 }),
    })),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Galerie</h2>
          <p className="text-sm text-neutral-600">Tes images uploadées ou générées par IA.</p>
        </div>
        <GalleryAddButton styles={styles.map((s) => ({ id: s.id, name: s.name }))} />
      </header>

      {withUrls.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucune image. Ajoute-en une.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {withUrls.map((img) => (
            <ImageCard key={img.mediaId} {...img} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Nav link**

`src/components/layout/app-header.tsx` — ajouter l'icône `Image` à l'import lucide et l'entrée :

```tsx
import { FileText, Image as ImageIcon, Lightbulb } from 'lucide-react';

const APP_LINKS = [
  { href: '/ideas', label: 'Idées', icon: Lightbulb },
  { href: '/posts', label: 'Posts', icon: FileText },
  { href: '/media', label: 'Galerie', icon: ImageIcon },
];
```

- [ ] **Step 5: Smoke test manuel**

```bash
# Terminal 1 : npm run dev   Terminal 2 : CONTENT_OS_GEMINI_STUB=1 npm run worker
```

Aller sur `/media` → "Ajouter une image" → Upload un PNG → apparait. Onglet IA → prompt → Générer → (stub) image apparait. Supprimer → disparait.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/media/page.tsx src/app/\(app\)/media/_components \
  src/components/layout/app-header.tsx
git commit -m "🤖 feat(spec-6): galerie /media + ImageCard + lien nav"
```

---

## Task 9: Post picker extension (Upload / IA / Galerie)

**Files:**
- Modify: `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx`, `src/app/(app)/posts/[id]/page.tsx`

- [ ] **Step 1: Charger styles + images galerie dans la page post**

`src/app/(app)/posts/[id]/page.tsx` — ajouter aux chargements :

```ts
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { listVisualStyles } from '@/lib/db/repositories/visual-styles';
// ...
const styles = await listVisualStyles(userId);
const galleryImages = await listStandaloneImages(userId);
const galleryWithUrls = await Promise.all(
  galleryImages.map(async ({ media }) => ({
    mediaId: media.id,
    signedUrl: await getStorage().signedUrl({ key: media.assetKey, expiresInSeconds: 3600 }),
  })),
);
```

Passer `styles`, `galleryWithUrls` à `<PostEditor>` puis à `<AddVisualDialog>`.

(Mettre à jour le type `Props` de `PostEditor` pour transmettre ces champs jusqu'à `AddVisualDialog`.)

- [ ] **Step 2: Étendre AddVisualDialog**

`src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` — étape 1 (quand `!selected`), au-dessus de la liste des templates, ajouter une rangée de boutons de mode :

```tsx
// Nouveaux props
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  templates: VisualTemplate[];
  styles: { id: string; name: string }[];
  galleryImages: { mediaId: string; signedUrl: string }[];
};

// État
const [mode, setMode] = useState<'template' | 'image' | 'gallery'>('template');
const [addImageOpen, setAddImageOpen] = useState(false);
const router = useRouter();
const [attaching, startAttach] = useTransition();

// Dans le rendu, quand !selected : barre de modes
<div className="flex gap-2 mb-3">
  <Button variant={mode === 'template' ? 'default' : 'outline'} size="sm" onClick={() => setMode('template')}>Template</Button>
  <Button variant={mode === 'image' ? 'default' : 'outline'} size="sm" onClick={() => { setMode('image'); setAddImageOpen(true); }}>Upload / IA</Button>
  <Button variant={mode === 'gallery' ? 'default' : 'outline'} size="sm" onClick={() => setMode('gallery')}>Galerie</Button>
</div>

// mode === 'template' : la liste existante de templates
// mode === 'gallery' : grille d'images cliquables → attachExistingMediaAction
{mode === 'gallery' && (
  galleryImages.length === 0 ? (
    <p className="text-sm text-muted-foreground">Galerie vide.</p>
  ) : (
    <div className="grid grid-cols-3 gap-2">
      {galleryImages.map((img) => (
        <button
          key={img.mediaId}
          type="button"
          disabled={attaching}
          onClick={() =>
            startAttach(async () => {
              const r = await attachExistingMediaAction({ postId, mediaId: img.mediaId });
              if (r.status === 'error') toast.error(r.message);
              else {
                toast.success('Visuel attaché');
                onOpenChange(false);
                router.refresh();
              }
            })
          }
          className="border rounded overflow-hidden hover:ring-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.signedUrl} alt="" className="w-full h-auto" />
        </button>
      ))}
    </div>
  )
)}

// AddImageDialog imbriqué (Upload | IA) avec postId → attache au post
<AddImageDialog
  open={addImageOpen}
  onOpenChange={setAddImageOpen}
  postId={postId}
  styles={styles}
  onDone={() => { onOpenChange(false); router.refresh(); }}
/>
```

Imports à ajouter : `useRouter` de next/navigation, `attachExistingMediaAction` de `../media-actions`, `AddImageDialog` de `@/components/media/add-image-dialog`.

- [ ] **Step 3: Typecheck + build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

- [ ] **Step 4: Smoke test manuel**

Post → "Ajouter un visuel" → "Galerie" → clic image → attachée. "Upload / IA" → upload/génère → attachée.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/posts/\[id\]/_components/add-visual-dialog.tsx src/app/\(app\)/posts/\[id\]/page.tsx
git commit -m "🤖 feat(spec-6): post picker — Upload / IA / Galerie en plus des templates"
```

---

## Task 10: E2E + lint/format/typecheck

**Files:**
- Modify: `test/e2e/global-setup.ts`
- Create: `test/e2e/media-gallery.spec.ts`, `test/e2e/post-image.spec.ts`

- [ ] **Step 1: Propager le stub Gemini au worker E2E**

`test/e2e/global-setup.ts` — dans l'objet `env` du spawn worker, ajouter :

```ts
      CONTENT_OS_GEMINI_STUB: '1',
```

- [ ] **Step 2: E2E galerie**

`test/e2e/media-gallery.spec.ts` (copier le helper `signup` depuis `test/e2e/visual-templates.spec.ts`) :

```ts
import { expect, type Page, test } from '@playwright/test';
// ... (copier fetchMagicLink + signup comme dans visual-templates.spec.ts)

test.describe('Galerie média', () => {
  test.describe.configure({ timeout: 120_000 });

  test('générer une image via IA (stub) puis la supprimer', async ({ page }) => {
    await signup(page, `pw-media-${Date.now()}@test.invalid`);
    await page.goto('/media');
    await expect(page.getByRole('heading', { name: 'Galerie' })).toBeVisible();
    await expect(page.getByText('Aucune image. Ajoute-en une.')).toBeVisible();

    await page.getByRole('button', { name: '+ Ajouter une image' }).click();
    await page.getByRole('button', { name: "Générer avec l'IA" }).click();
    await page.getByLabel('Prompt').fill('un robot minimaliste');
    await page.getByRole('button', { name: 'Générer' }).click();
    await expect(page.getByText('Image générée')).toBeVisible({ timeout: 30_000 });

    // une vignette apparait
    await expect(page.locator('img').first()).toBeVisible();

    await page.getByRole('button', { name: 'Supprimer' }).first().click();
    await page.getByRole('button', { name: /^Supprimer$/ }).click();
    await expect(page.getByText('Aucune image. Ajoute-en une.')).toBeVisible();
  });
});
```

- [ ] **Step 3: E2E post image**

`test/e2e/post-image.spec.ts` — crée idée+post (stub Claude), ouvre le post, "Ajouter un visuel" → "Upload / IA" → Générer IA (stub) → attaché ; puis "Galerie" → ré-attache. Reprendre le pattern de `test/e2e/post-visual.spec.ts` (génération de post via stub + navigation `/posts`).

```ts
import { expect, type Page, test } from '@playwright/test';
// ... (copier fetchMagicLink + signup)

test.describe('Post image (upload/IA/galerie)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('générer une image IA et l\'attacher au post', async ({ page }) => {
    await signup(page, `pw-postimg-${Date.now()}@test.invalid`);

    // idée + post (stub Claude)
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Idée image');
    await page.fill('textarea[name="brief"]', 'brief pour image.');
    await page.click('button:has-text("Ajouter")');
    await page.locator('button:has-text("Générer un post")').first().click();
    await expect(page.locator('text=Post créé')).toBeVisible({ timeout: 30_000 });
    await page.goto('/posts');
    await page.locator('a').filter({ hasText: /Idée image/i }).first().click();
    await expect(page).toHaveURL(/\/posts\/.+/);

    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: /Upload \/ IA/ }).click();
    await page.getByRole('button', { name: "Générer avec l'IA" }).click();
    await page.getByLabel('Prompt').fill('un robot');
    await page.getByRole('button', { name: 'Générer' }).click();
    await expect(page.getByText('Image générée')).toBeVisible({ timeout: 30_000 });

    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(page.locator('img[alt="Visuel du post"]')).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 4: Run E2E (stubs)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null; npm run build 2>&1 | tail -2
CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e -- test/e2e/media-gallery.spec.ts test/e2e/post-image.spec.ts 2>&1 | tail -15
```

Fix any selector mismatches inline.

- [ ] **Step 5: Lint + format + typecheck + full unit/int/worker**

```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

Expected: tout vert (3 warnings `<img>` acceptés).

- [ ] **Step 6: Commit**

```bash
git add test/e2e
git commit -m "🤖 test(spec-6): e2e galerie + post image (Gemini stubbé)"
```

---

## Task 11: Full E2E + push + PR

- [ ] **Step 1: Run full E2E suite (no regression)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null
CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e 2>&1 | tail -12
```

Expected: tous verts (les specs existantes + les 2 nouvelles).

- [ ] **Step 2: Push**

```bash
git push -u origin spec-6/image-library
```

- [ ] **Step 3: PR**

```bash
gh pr create --base main --head spec-6/image-library --title "spec 6: image library (upload + génération IA + galerie)" --body "$(cat <<'EOF'
## Summary
- Images standalone : upload (Server Action sync) + génération IA (queue generate-image + Gemini gemini-3-pro-image-preview)
- Galerie /media (grille, suppression avec FK SET NULL sur posts référents) + lien nav
- Module réutilisable AddImageDialog (Upload | Générer IA)
- Post picker étendu : Template | Upload / IA | Galerie
- Réutilise media/image_assets (source=standalone) + visual_styles ; zéro migration
- Stub CONTENT_OS_GEMINI_STUB pour CI/E2E

Spec : docs/superpowers/specs/2026-05-24-spec-6-image-library-design.md
Plan : docs/superpowers/plans/2026-05-24-spec-6-image-library.md

## Test plan
- [ ] npm test (unit + integration + worker, Gemini stubbé)
- [ ] CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e
- [ ] Smoke : upload + génération IA + attache post + galerie + suppression

## Hors-scope (specs suivants)
- Édition IA image-to-image
- Images dans les templates (DSL image type)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Watch CI green, report PR URL**

```bash
gh run watch <run-id> --exit-status
```

Ne pas merger sans Manu.

---

## Critères de réussite globale

Cf. spec § Critères de réussite. Synthèse :
- Upload + génération IA + galerie + attache post fonctionnels.
- Suppression galerie → posts référents repassent sans visuel.
- Tenant isolation verte. `npm test` + `npm run test:e2e` verts (stubs). Lint + tsc clean.
- PR ouverte sur `spec-6/image-library`, CI verte, prête à merger (pas de merge auto).
