# Spec 7 (Images dans templates + édition IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux templates d'intégrer des variables image (mediaId → URL R2 signée → Puppeteer fetch) et d'éditer une image existante avec l'IA (image-to-image Gemini) depuis la galerie ; simplifier le storage (R2 en dev+prod).

**Architecture:** DSL en union discriminée (`string` | `image`). Le worker render-visual résout les vars image en URL signées R2 avant compile. La queue `generate-image` gagne une branche édition via `sourceMediaId` (download bytes → `editImage` Gemini). `getStorage()` : R2 dev+prod, InMemory tests, Filesystem E2E. Ajout de `download()` à l'interface Storage.

**Tech Stack:** Drizzle/Postgres, BullMQ/Redis, R2 (`@aws-sdk/client-s3`) + InMemory/Filesystem, `@google/genai`, Next.js 16 App Router + React 19, shadcn/ui, Vitest, Playwright.

**Référence spec :** `docs/superpowers/specs/2026-05-24-spec-7-template-images-and-ai-edit-design.md`

---

## File Structure

**Nouveaux fichiers :**
- `src/lib/media/mime.ts` — `mimeFromKey(key): string` (factorise la table extension→mime).
- `test/unit/storage-download.test.ts`, `test/unit/mime.test.ts`.

**Modifiés :**
- `src/lib/storage/types.ts` — `download(key): Promise<Buffer>`.
- `src/lib/storage/r2.ts`, `in-memory.ts`, `filesystem.ts` — implémentent `download`.
- `src/lib/storage/index.ts` — `getStorage()` : R2 dev+prod, InMemory test, Filesystem E2E, throw sinon.
- `src/app/api/storage/[...key]/route.ts` — utilise `download` + `mimeFromKey`.
- `src/lib/visual-templates/dsl.ts` — union `string` | `image`.
- `src/app/(app)/settings/visual-templates/variables-schema-editor.tsx` — select type.
- `src/worker/queues/render-visual.ts` — résolution vars image.
- `src/app/(app)/posts/[id]/_components/variables-form.tsx` — input image.
- `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` + `page.tsx` — passe galleryImages/styles à VariablesForm.
- `src/lib/ai/generate-image.ts` — `editImage` + `editImageStub` + `EditImageFn`.
- `src/lib/queue/client.ts` — `GenerateImageJob.sourceMediaId?`, `aspectRatio?`.
- `src/worker/queues/generate-image.ts` — branche édition.
- `src/worker/index.ts` — injecte `editImage`.
- `src/app/(app)/media/actions.ts` — `enqueueEditImageAction`.
- `src/app/(app)/media/_components/image-card.tsx` — bouton « Éditer avec l'IA ».
- Tests étendus : `visual-templates-dsl.test.ts`, `visual-templates-compile.test.ts`, `render-visual.test.ts`, `generate-image.test.ts`, `media-actions.test.ts`, `visual-template-create-action.test.ts`.
- E2E : `test/e2e/template-image-var.spec.ts`, `test/e2e/image-edit.spec.ts`.

---

## Task 1: Storage `download` + mime helper + getStorage R2

**Files:**
- Create: `src/lib/media/mime.ts`, `test/unit/mime.test.ts`, `test/unit/storage-download.test.ts`
- Modify: `src/lib/storage/types.ts`, `r2.ts`, `in-memory.ts`, `filesystem.ts`, `index.ts`, `src/app/api/storage/[...key]/route.ts`

- [ ] **Step 1: mime helper + test**

Create `src/lib/media/mime.ts` :

```ts
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function mimeFromKey(key: string): string {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
```

Create `test/unit/mime.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { mimeFromKey } from '@/lib/media/mime';

describe('mimeFromKey', () => {
  test('mappe les extensions connues', () => {
    expect(mimeFromKey('media/u/x.png')).toBe('image/png');
    expect(mimeFromKey('a.jpg')).toBe('image/jpeg');
    expect(mimeFromKey('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromKey('a.webp')).toBe('image/webp');
  });
  test('fallback octet-stream', () => {
    expect(mimeFromKey('a.gif')).toBe('application/octet-stream');
    expect(mimeFromKey('noext')).toBe('application/octet-stream');
  });
});
```

- [ ] **Step 2: Add `download` to the Storage interface**

`src/lib/storage/types.ts` :

```ts
export interface Storage {
  upload(opts: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<void>;
  signedUrl(opts: { key: string; expiresInSeconds?: number }): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

- [ ] **Step 3: Implement `download` in the 3 backends**

`src/lib/storage/in-memory.ts` — ajouter :

```ts
async download(key: string): Promise<Buffer> {
  const blob = this.store.get(key);
  if (!blob) throw new Error(`Key not found: ${key}`);
  return blob.body;
}
```

`src/lib/storage/filesystem.ts` — renommer `read` en `download` (et adapter l'appelant route en Step 5) :

```ts
async download(key: string): Promise<Buffer> {
  return readFile(this.resolveKey(key));
}
```

`src/lib/storage/r2.ts` — ajouter (import `GetObjectCommand` déjà présent) :

```ts
async download(key: string): Promise<Buffer> {
  const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}
```

- [ ] **Step 4: storage-download unit test**

`test/unit/storage-download.test.ts` :

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { FilesystemStorage } from '@/lib/storage/filesystem';
import { InMemoryStorage } from '@/lib/storage/in-memory';

describe('InMemoryStorage.download', () => {
  test('round-trip', async () => {
    const s = new InMemoryStorage();
    await s.upload({ key: 'a.png', body: Buffer.from('HELLO'), contentType: 'image/png' });
    expect((await s.download('a.png')).toString()).toBe('HELLO');
  });
  test('throw si absent', async () => {
    const s = new InMemoryStorage();
    await expect(s.download('missing.png')).rejects.toThrow(/not found/i);
  });
});

describe('FilesystemStorage.download', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fs-dl-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
  test('round-trip', async () => {
    const s = new FilesystemStorage(root);
    await s.upload({ key: 'd/a.png', body: Buffer.from('DATA'), contentType: 'image/png' });
    expect((await s.download('d/a.png')).toString()).toBe('DATA');
  });
});
```

- [ ] **Step 5: Update `/api/storage` route to use `download` + `mimeFromKey`**

`src/app/api/storage/[...key]/route.ts` — remplacer la table locale et `storage.read` :

```ts
import { getStorage } from '@/lib/storage';
import { FilesystemStorage } from '@/lib/storage/filesystem';
import { mimeFromKey } from '@/lib/media/mime';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const storage = getStorage();
  if (!(storage instanceof FilesystemStorage)) {
    return new Response('Not found', { status: 404 });
  }
  const { key: segments } = await params;
  const key = segments.join('/');
  if (key.includes('..')) return new Response('Invalid key', { status: 400 });
  try {
    const buf = await storage.download(key);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { 'Content-Type': mimeFromKey(key), 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
```

- [ ] **Step 6: Simplify `getStorage()`**

`src/lib/storage/index.ts` :

```ts
import { env } from '@/lib/env';
import { FilesystemStorage } from './filesystem';
import { InMemoryStorage } from './in-memory';
import { R2Storage } from './r2';
import type { Storage } from './types';

let instance: Storage | undefined;

export function getStorage(): Storage {
  if (instance) return instance;
  if (env.E2E_TESTING === 'true') {
    instance = new FilesystemStorage(); // E2E multi-process, pas de secret R2 en CI
  } else if (env.NODE_ENV === 'test') {
    instance = new InMemoryStorage(); // unit/integration/worker, hermétique
  } else if (env.R2_ACCOUNT_ID) {
    instance = new R2Storage(env.R2_BUCKET!, {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  } else {
    throw new Error(
      'Storage R2 requis hors tests : configure R2_ACCOUNT_ID/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY.',
    );
  }
  return instance;
}

export type { Storage };
```

- [ ] **Step 7: Run unit + integration (no regression)**

```bash
npm run test:unit -- mime storage-download storage
npm run test:integration
```

Expected: verts (le storage test InMemory existant passe toujours).

- [ ] **Step 8: Commit**

```bash
git add src/lib/media/mime.ts src/lib/storage test/unit/mime.test.ts test/unit/storage-download.test.ts src/app/api/storage
git commit -m "🤖 feat(spec-7): storage download() + mimeFromKey + getStorage R2 dev/prod"
```

---

## Task 2: DSL union (image type)

**Files:**
- Modify: `src/lib/visual-templates/dsl.ts`
- Test: `test/unit/visual-templates-dsl.test.ts`

- [ ] **Step 1: Write failing tests (extend)**

Ajouter dans `test/unit/visual-templates-dsl.test.ts` :

```ts
import { /* existant */ parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

describe('image variables', () => {
  test('parse une var image', () => {
    const raw = [{ name: 'photo', label: 'Photo', type: 'image' }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('parse une var image optionnelle', () => {
    const raw = [{ name: 'photo', label: 'Photo', type: 'image', optional: true }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('type inconnu rejeté', () => {
    expect(() =>
      parseVariablesSchema([{ name: 'x', label: 'X', type: 'video' }]),
    ).toThrow();
  });

  test('zod : image requise = mediaId non vide', () => {
    const zod = variablesSchemaToZod([{ name: 'photo', label: 'P', type: 'image' }]);
    expect(zod.parse({ photo: 'media123' })).toEqual({ photo: 'media123' });
    expect(() => zod.parse({ photo: '' })).toThrow();
    expect(() => zod.parse({})).toThrow();
  });

  test('zod : image optionnelle peut manquer', () => {
    const zod = variablesSchemaToZod([{ name: 'photo', label: 'P', type: 'image', optional: true }]);
    expect(zod.parse({})).toEqual({});
  });

  test('schéma mixte string + image', () => {
    const raw = [
      { name: 'title', label: 'T', type: 'string', max: 50 },
      { name: 'photo', label: 'P', type: 'image' },
    ];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });
});
```

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:unit -- visual-templates-dsl
```

- [ ] **Step 3: Implement the union**

Réécrire `src/lib/visual-templates/dsl.ts` :

```ts
import { type ZodObject, type ZodTypeAny, z } from 'zod';

const identifier = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'invalid identifier');

const stringSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('string'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive(),
  optional: z.boolean().optional(),
});

const imageSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('image'),
  optional: z.boolean().optional(),
});

const variableSpecSchema = z.discriminatedUnion('type', [stringSpec, imageSpec]);

export type VariableSpec = z.infer<typeof variableSpecSchema>;
export type StringVariableSpec = z.infer<typeof stringSpec>;
export type ImageVariableSpec = z.infer<typeof imageSpec>;
export type VariablesSchema = VariableSpec[];

const variablesSchemaMeta = z.array(variableSpecSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const v of arr) {
    if (seen.has(v.name)) {
      ctx.addIssue({ code: 'custom', message: `duplicate variable name: ${v.name}` });
    }
    seen.add(v.name);
  }
});

export function parseVariablesSchema(raw: unknown): VariablesSchema {
  return variablesSchemaMeta.parse(raw);
}

export function variablesSchemaToZod(
  schema: VariablesSchema,
): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const v of schema) {
    if (v.type === 'string') {
      let s = z.string().trim();
      if (v.min !== undefined) s = s.min(v.min);
      s = s.max(v.max);
      shape[v.name] = v.optional ? s.optional() : s;
    } else {
      // image : valeur = mediaId
      const s = z.string();
      shape[v.name] = v.optional ? s.optional() : s.min(1);
    }
  }
  return z.object(shape);
}
```

- [ ] **Step 4: Run (expected PASS) — including existing string tests**

```bash
npm run test:unit -- visual-templates-dsl
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/visual-templates/dsl.ts test/unit/visual-templates-dsl.test.ts
git commit -m "🤖 feat(spec-7): DSL union string|image + zod mediaId pour image"
```

---

## Task 3: Back-office VariablesSchemaEditor — type select

**Files:**
- Modify: `src/app/(app)/settings/visual-templates/variables-schema-editor.tsx`

- [ ] **Step 1: Add a type select per variable**

Dans `variables-schema-editor.tsx` : `EMPTY` reste `{ name:'', label:'', type:'string', max:100 }`. Ajouter un `<Select>` `type` en tête de chaque row. Quand `type === 'image'`, ne pas rendre les champs min/max. Le `update` doit gérer le changement de type (quand on passe à image, retirer min/max ; quand on passe à string, garantir un `max`).

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// helper de changement de type :
const changeType = (uid: string, type: 'string' | 'image') => {
  setRows((arr) =>
    arr.map((r) => {
      if (r.uid !== uid) return r;
      if (type === 'image') {
        return { uid, spec: { name: r.spec.name, label: r.spec.label, description: r.spec.description, type: 'image', optional: r.spec.optional } };
      }
      return { uid, spec: { name: r.spec.name, label: r.spec.label, description: r.spec.description, type: 'string', max: 100, optional: r.spec.optional } };
    }),
  );
};

// dans la row, avant name/label :
<div>
  <Label>Type</Label>
  <Select value={v.type} onValueChange={(t) => changeType(uid, (t as 'string' | 'image') ?? 'string')}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="string">Texte</SelectItem>
      <SelectItem value="image">Image</SelectItem>
    </SelectContent>
  </Select>
</div>

// le bloc min/max n'est rendu que si v.type === 'string'
{v.type === 'string' && ( /* … bloc Min/Max existant … */ )}
```

(`Row` type devient `{ uid: string; spec: VariableSpec }` avec `VariableSpec` désormais l'union. Les accès `v.min`/`v.max` doivent être gardés par `v.type === 'string'`.)

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: pas d'erreur (les accès min/max sont narrowed par `v.type === 'string'`).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/visual-templates/variables-schema-editor.tsx
git commit -m "🤖 feat(spec-7): éditeur de variables — select type (texte|image)"
```

---

## Task 4: render-visual — résolution des variables image

**Files:**
- Modify: `src/worker/queues/render-visual.ts`
- Test: `test/worker/render-visual.test.ts`

- [ ] **Step 1: Write failing test (extend)**

Ajouter dans `test/worker/render-visual.test.ts` (le mock `renderHtmlToPng` capture le `html`) :

```ts
import { createImageAsset } from '@/lib/db/repositories/image-assets';

const IMG_TEMPLATE = {
  slug: 'with-image',
  label: 'With image',
  platform: 'linkedin',
  width: 800,
  height: 600,
  bodyHtml: '<img src="{{photo}}">',
  css: '',
  variablesSchema: [{ name: 'photo', label: 'Photo', type: 'image' }],
  sampleVars: { photo: '' },
};

test('mode=final : var image résolue en URL signée injectée dans le HTML', async () => {
  const userId = await createTestUser('rv-img');
  await upsertSettings(userId);
  const tmpl = await createVisualTemplate(userId, IMG_TEMPLATE);
  // une image standalone existante
  const m = await createMedia(userId, {
    kind: 'image', assetKey: `media/${userId}/img.png`, previewKey: 'p', width: 10, height: 10,
  });
  await createImageAsset(userId, { mediaId: m.id, source: 'standalone' });
  const idea = await createIdea(userId, { idea: 'I', brief: 'B' });
  const post = await createPost(userId, { ideaId: idea.id, content: 'C' });

  const storage = new InMemoryStorage();
  // signedUrl InMemory exige que la clé existe :
  await storage.upload({ key: m.assetKey, body: Buffer.from('x'), contentType: 'image/png' });
  let capturedHtml = '';
  const renderFn = vi.fn().mockImplementation(async (opts: { html: string }) => {
    capturedHtml = opts.html;
    return Buffer.from('PNG');
  });
  const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

  await handler(
    makeJob({ userId, templateId: tmpl!.id, vars: { photo: m.id }, mode: 'final', postId: post.id, jobKey: 'ki' }),
  );
  expect(capturedHtml).toContain(`<img src="https://test.invalid/${m.assetKey}`);
});

test('mode=preview : var image sans mediaId → placeholder dans le HTML', async () => {
  const userId = await createTestUser('rv-imgph');
  await upsertSettings(userId);
  const tmpl = await createVisualTemplate(userId, IMG_TEMPLATE);
  const storage = new InMemoryStorage();
  let capturedHtml = '';
  const renderFn = vi.fn().mockImplementation(async (opts: { html: string }) => {
    capturedHtml = opts.html;
    return Buffer.from('PNG');
  });
  const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

  await handler(makeJob({ userId, templateId: tmpl!.id, vars: { photo: '' }, mode: 'preview', jobKey: 'kp' }));
  expect(capturedHtml).toContain('data:image/svg+xml');
});
```

(Vérifier que `createMedia`, `createImageAsset`, `createVisualTemplate`, `upsertSettings`, `createIdea`, `createPost` sont importés en tête du fichier.)

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:worker -- render-visual
```

- [ ] **Step 3: Implement image var resolution**

Dans `src/worker/queues/render-visual.ts` : ajouter l'import `getMedia` et résoudre les vars image avant le compile.

```ts
import { getMedia } from '@/lib/db/repositories/media';

const IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e5e5"/></svg>',
  );

// … après: const validated = variablesSchemaToZod(schema).parse(vars) as Record<string, unknown>;
const context: Record<string, unknown> = { ...validated };
for (const spec of schema) {
  if (spec.type !== 'image') continue;
  const mediaId = typeof validated[spec.name] === 'string' ? (validated[spec.name] as string) : '';
  let url = mode === 'preview' ? IMAGE_PLACEHOLDER : '';
  if (mediaId) {
    const m = await getMedia(userId, mediaId);
    if (m) url = await deps.storage.signedUrl({ key: m.assetKey, expiresInSeconds: 3600 });
  }
  context[spec.name] = url;
}

const html = compileTemplate({ template, vars: context, brand });
```

(Le `createImageAsset` du mode final continue de stocker `vars: validated` — donc les mediaId, pas les URL.)

- [ ] **Step 4: Run (expected PASS)**

```bash
npm run test:worker -- render-visual
```

- [ ] **Step 5: Commit**

```bash
git add src/worker/queues/render-visual.ts test/worker/render-visual.test.ts
git commit -m "🤖 feat(spec-7): render-visual résout les vars image (URL signée R2 + placeholder preview)"
```

---

## Task 5: VariablesForm — input image dans le post picker

**Files:**
- Modify: `src/app/(app)/posts/[id]/_components/variables-form.tsx`, `add-visual-dialog.tsx`, `page.tsx`

- [ ] **Step 1: VariablesForm gère le type image**

Réécrire `src/app/(app)/posts/[id]/_components/variables-form.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { AddImageDialog } from '@/components/media/add-image-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

type GalleryImage = { mediaId: string; signedUrl: string };
type Style = { id: string; name: string };

type Props = {
  schema: VariableSpec[];
  initial: Record<string, unknown>;
  galleryImages: GalleryImage[];
  styles: Style[];
  onChange: (vars: Record<string, unknown>) => void;
};

export function VariablesForm({ schema, initial, galleryImages, styles, onChange }: Props) {
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const v of schema) seed[v.name] = String(initial[v.name] ?? '');
    return seed;
  });
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);

  const update = (name: string, value: string) => {
    const next = { ...vars, [name]: value };
    setVars(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {schema.map((v) => {
        if (v.type === 'image') {
          const selected = vars[v.name];
          return (
            <div key={v.name} className="space-y-1">
              <Label>
                {v.label}{' '}
                <span className="text-xs text-muted-foreground">
                  (image{v.optional ? ', opt' : ''})
                </span>
              </Label>
              {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((img) => (
                  <button
                    key={img.mediaId}
                    type="button"
                    onClick={() => update(v.name, img.mediaId)}
                    className={`border rounded overflow-hidden ${selected === img.mediaId ? 'ring-2 ring-neutral-900' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.signedUrl} alt="" className="w-full h-auto" />
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpenFor(v.name)}
              >
                Ajouter (upload / IA)
              </Button>
              <AddImageDialog
                open={addOpenFor === v.name}
                onOpenChange={(o) => setAddOpenFor(o ? v.name : null)}
                styles={styles}
                onDone={() => setAddOpenFor(null)}
              />
            </div>
          );
        }
        const isLong = v.max > 80;
        return (
          <div key={v.name} className="space-y-1">
            <Label htmlFor={`var-${v.name}`}>
              {v.label}{' '}
              <span className="text-xs text-muted-foreground">
                ({v.optional ? 'opt' : 'req'}, max {v.max})
              </span>
            </Label>
            {isLong ? (
              <Textarea
                id={`var-${v.name}`}
                value={vars[v.name] ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
                rows={3}
              />
            ) : (
              <Input
                id={`var-${v.name}`}
                value={vars[v.name] ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
              />
            )}
            {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
```

(Note : `AddImageDialog` sans `postId` crée juste une image standalone. Après ajout, `onDone` ferme le dialog ; la nouvelle image apparait dans `galleryImages` au prochain `router.refresh` — déclenché par le parent. Pour le MVP hyper-simple, l'utilisateur peut rouvrir le picker après refresh. UX revue plus tard.)

- [ ] **Step 2: Passer galleryImages + styles à VariablesForm via AddVisualDialog**

Dans `add-visual-dialog.tsx`, le composant a déjà `styles` et `galleryImages` en props (Spec 6). Passer ces props à `<VariablesForm>` :

```tsx
<VariablesForm
  schema={selected.variablesSchema as VariableSpec[]}
  initial={(selected.sampleVars as Record<string, unknown>) ?? {}}
  galleryImages={galleryImages}
  styles={styles}
  onChange={setVars}
/>
```

- [ ] **Step 3: Typecheck + build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

`page.tsx` passe déjà `styles` et `galleryImages` (Spec 6) — rien à changer côté page.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/posts/\[id\]/_components/variables-form.tsx src/app/\(app\)/posts/\[id\]/_components/add-visual-dialog.tsx
git commit -m "🤖 feat(spec-7): VariablesForm — input image (galerie + ajouter) pour les vars image"
```

---

## Task 6: editImage Gemini + worker generate-image branche édition

**Files:**
- Modify: `src/lib/ai/generate-image.ts`, `src/lib/queue/client.ts`, `src/worker/queues/generate-image.ts`, `src/worker/index.ts`
- Test: `test/worker/generate-image.test.ts`

- [ ] **Step 1: editImage + stub + EditImageFn**

Ajouter dans `src/lib/ai/generate-image.ts` :

```ts
export type EditImageFn = (opts: {
  imageBytes: Buffer;
  mimeType: string;
  prompt: string;
}) => Promise<Buffer>;

export const editImage: EditImageFn = async ({ imageBytes, mimeType, prompt }) => {
  const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });
  const response = await gemini.models.generateContent({
    model: MODEL,
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

- [ ] **Step 2: GenerateImageJob — sourceMediaId + aspectRatio optionnel**

`src/lib/queue/client.ts` — modifier `GenerateImageJob` :

```ts
export type GenerateImageJob = {
  userId: string;
  prompt: string;
  aspectRatio?: string;
  styleId?: string;
  sourceMediaId?: string;
  postId?: string;
  jobKey: string;
};
```

- [ ] **Step 3: Write worker test (extend)**

Ajouter dans `test/worker/generate-image.test.ts` :

```ts
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia, getMedia } from '@/lib/db/repositories/media';

test('avec sourceMediaId : édition image-to-image (editImage appelé avec les bytes source)', async () => {
  const userId = await createTestUser('gi-edit');
  const storage = new InMemoryStorage();
  // image source dans le storage + DB
  const src = await createMedia(userId, {
    kind: 'image', assetKey: `media/${userId}/src.png`, previewKey: 'p', width: 10, height: 10,
  });
  await createImageAsset(userId, { mediaId: src.id, source: 'standalone' });
  await storage.upload({ key: src.assetKey, body: Buffer.from('SRCBYTES'), contentType: 'image/png' });

  const editFn = vi.fn().mockResolvedValue(Buffer.from('EDITED'));
  const genFn = vi.fn();
  const handler = makeProcessGenerateImage({ storage, generateImage: genFn, editImage: editFn });

  const res = await handler(
    makeJob({ userId, prompt: 'rends-le bleu', sourceMediaId: src.id, jobKey: 'ge1' }),
  );
  expect(genFn).not.toHaveBeenCalled();
  expect(editFn).toHaveBeenCalledWith(
    expect.objectContaining({ prompt: 'rends-le bleu', mimeType: 'image/png' }),
  );
  // la nouvelle image trace la source
  const created = await getMedia(userId, res.mediaId);
  expect(created).toBeDefined();
});

test('sans sourceMediaId : génération texte→image (inchangé)', async () => {
  const userId = await createTestUser('gi-txt');
  const storage = new InMemoryStorage();
  const editFn = vi.fn();
  const genFn = vi.fn().mockResolvedValue(Buffer.from('GEN'));
  const handler = makeProcessGenerateImage({ storage, generateImage: genFn, editImage: editFn });
  await handler(makeJob({ userId, prompt: 'un chat', aspectRatio: '1:1', jobKey: 'ge2' }));
  expect(genFn).toHaveBeenCalledOnce();
  expect(editFn).not.toHaveBeenCalled();
});
```

(Les `makeProcessGenerateImage` existants dans le fichier passent maintenant `editImage` dans deps — mettre à jour les 3 appels existants pour ajouter `editImage: vi.fn()`.)

- [ ] **Step 4: Run (expected FAIL)**

```bash
npm run test:worker -- generate-image
```

- [ ] **Step 5: Implement worker branch**

`src/worker/queues/generate-image.ts` — deps + branche :

```ts
import type { EditImageFn, GenerateImageFn } from '@/lib/ai/generate-image';
import { getMedia } from '@/lib/db/repositories/media';
import { mimeFromKey } from '@/lib/media/mime';

type Deps = { storage: Storage; generateImage: GenerateImageFn; editImage: EditImageFn };

export function makeProcessGenerateImage(deps: Deps) {
  return async function processGenerateImage(
    job: Job<GenerateImageJob>,
  ): Promise<GenerateImageResult> {
    const { userId, prompt, aspectRatio, styleId, sourceMediaId, postId } = job.data;

    let png: Buffer;
    let aiSourceKey: string | null = null;
    if (sourceMediaId) {
      const source = await getMedia(userId, sourceMediaId);
      if (!source) throw new Error(`source media ${sourceMediaId} not found for user ${userId}`);
      const bytes = await deps.storage.download(source.assetKey);
      png = await deps.editImage({ imageBytes: bytes, mimeType: mimeFromKey(source.assetKey), prompt });
      aiSourceKey = source.assetKey;
    } else {
      let stylePrompt: string | null = null;
      if (styleId) {
        const style = await getVisualStyle(userId, styleId);
        stylePrompt = style?.prompt ?? null;
      }
      png = await deps.generateImage({ prompt, aspectRatio: aspectRatio ?? '1:1', stylePrompt });
    }

    const dims = imageSize(png);
    const mediaId = createId();
    const assetKey = `media/${userId}/${mediaId}.png`;
    await deps.storage.upload({ key: assetKey, body: png, contentType: 'image/png' });
    await createMedia(
      userId,
      { kind: 'image', assetKey, previewKey: assetKey, width: dims.width ?? 1024, height: dims.height ?? 1024 },
      mediaId,
    );
    await createImageAsset(userId, {
      mediaId,
      source: 'standalone',
      aiBrief: prompt,
      styleId: styleId ?? null,
      aiSourceKey,
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

(Garder les imports existants : `imageSize`, `createId`, `createImageAsset`, `createMedia`, `getPost`, `updatePost`, `getVisualStyle`, types.)

- [ ] **Step 6: Run (expected PASS)**

```bash
npm run test:worker -- generate-image
```

- [ ] **Step 7: Inject editImage in worker entrypoint**

`src/worker/index.ts` :

```ts
import { editImage, editImageStub, generateImage, generateImageStub } from '@/lib/ai/generate-image';
// …
const editImageFn = env.CONTENT_OS_GEMINI_STUB === '1' ? editImageStub : editImage;
// dans le Worker generate-image :
new Worker(
  'generate-image',
  makeProcessGenerateImage({ storage: getStorage(), generateImage: generateImageFn, editImage: editImageFn }),
  { connection, concurrency: 2 },
),
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/generate-image.ts src/lib/queue/client.ts src/worker/queues/generate-image.ts src/worker/index.ts test/worker/generate-image.test.ts
git commit -m "🤖 feat(spec-7): édition IA image-to-image (editImage Gemini + branche worker sourceMediaId)"
```

---

## Task 7: enqueueEditImageAction + ImageCard « Éditer avec l'IA »

**Files:**
- Modify: `src/app/(app)/media/actions.ts`, `src/app/(app)/media/_components/image-card.tsx`
- Test: `test/integration/media-actions.test.ts`

- [ ] **Step 1: Write integration test (extend — error paths only)**

Ajouter dans `test/integration/media-actions.test.ts` :

```ts
import { enqueueEditImageAction } from '@/app/(app)/media/actions';
```

> ⚠️ `enqueueEditImageAction` est une Server Action (`requireUserId` lit la session). En integration on n'a pas de session → on ne peut pas l'appeler directement. À la place, extraire la garde dans un core testable :

Créer `src/app/(app)/media/edit-image-core.ts` :

```ts
import { getMedia } from '@/lib/db/repositories/media';

export async function editImageGuard(
  userId: string,
  input: { mediaId: string; prompt: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.prompt.trim()) return { ok: false, message: 'Prompt requis' };
  const m = await getMedia(userId, input.mediaId);
  if (!m) return { ok: false, message: 'Image introuvable' };
  return { ok: true };
}
```

Test :

```ts
import { editImageGuard } from '@/app/(app)/media/edit-image-core';

describe('editImageGuard', () => {
  test('prompt vide rejeté', async () => {
    const userId = await createTestUser('eg-empty');
    expect((await editImageGuard(userId, { mediaId: 'x', prompt: '  ' })).ok).toBe(false);
  });
  test("image d'un autre user rejetée", async () => {
    const a = await createTestUser('eg-a');
    const b = await createTestUser('eg-b');
    const m = await makeStandalone(a);
    expect((await editImageGuard(b, { mediaId: m.id, prompt: 'x' })).ok).toBe(false);
  });
  test('ok si image possédée + prompt', async () => {
    const userId = await createTestUser('eg-ok');
    const m = await makeStandalone(userId);
    expect((await editImageGuard(userId, { mediaId: m.id, prompt: 'bleu' })).ok).toBe(true);
  });
});
```

(`makeStandalone` existe déjà dans ce fichier de test.)

- [ ] **Step 2: Run (expected FAIL)**

```bash
npm run test:integration -- media-actions
```

- [ ] **Step 3: Implement edit-image-core + action**

Créer `edit-image-core.ts` (cf. Step 1). Ajouter dans `src/app/(app)/media/actions.ts` :

```ts
import { editImageGuard } from './edit-image-core';

export async function enqueueEditImageAction(input: {
  mediaId: string;
  prompt: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const guard = await editImageGuard(userId, input);
  if (!guard.ok) return { status: 'error', message: guard.message };
  const jobKey = randomUUID();
  await enqueueGenerateImage({
    userId,
    prompt: input.prompt.trim(),
    sourceMediaId: input.mediaId,
    jobKey,
  });
  return { status: 'success', jobKey };
}
```

- [ ] **Step 4: Run (expected PASS)**

```bash
npm run test:integration -- media-actions
```

- [ ] **Step 5: ImageCard — bouton Éditer avec l'IA**

Modifier `src/app/(app)/media/_components/image-card.tsx` : ajouter un mini-dialog d'édition à côté du bouton Supprimer.

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useJobPolling } from '@/hooks/use-job-polling';
import { deleteImageAction, enqueueEditImageAction } from '../actions';

// … garder les props + la logique delete existantes …
// Ajouter l'état édition :
const router = useRouter();
const [editOpen, setEditOpen] = useState(false);
const [prompt, setPrompt] = useState('');
const [editing, startEdit] = useTransition();
const [editJobKey, setEditJobKey] = useState<string | null>(null);

useJobPolling(editJobKey, {
  queue: 'generate-image',
  defaultToast: false,
  onCompleted: () => {
    toast.success('Image éditée');
    setEditJobKey(null);
    setEditOpen(false);
    setPrompt('');
    router.refresh();
  },
});

const onEdit = () => {
  startEdit(async () => {
    const r = await enqueueEditImageAction({ mediaId, prompt });
    if (r.status === 'error') toast.error(r.message);
    else setEditJobKey(r.jobKey);
  });
};

const editWorking = editing || editJobKey !== null;

// Dans le footer de la card, à côté de Supprimer :
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogTrigger render={<Button variant="ghost" size="sm">Éditer (IA)</Button>} />
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Éditer avec l'IA</DialogTitle>
      <DialogDescription>Décris la modification. Une nouvelle image sera créée.</DialogDescription>
    </DialogHeader>
    <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="ex: passe le fond en bleu nuit" />
    <DialogFooter>
      <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editWorking}>Annuler</Button>
      <Button onClick={onEdit} disabled={editWorking || !prompt.trim()}>
        {editWorking ? 'Édition…' : 'Éditer'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Typecheck + build + commit**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
git add src/app/\(app\)/media/actions.ts src/app/\(app\)/media/edit-image-core.ts src/app/\(app\)/media/_components/image-card.tsx test/integration/media-actions.test.ts
git commit -m "🤖 feat(spec-7): édition IA depuis la galerie (action + ImageCard dialog)"
```

---

## Task 8: E2E + lint/format/tsc + full suite

**Files:**
- Create: `test/e2e/template-image-var.spec.ts`, `test/e2e/image-edit.spec.ts`

- [ ] **Step 1: E2E édition IA**

`test/e2e/image-edit.spec.ts` (copier `signup`/`fetchMagicLink` depuis `media-gallery.spec.ts`) :

```ts
test.describe('Édition IA', () => {
  test.describe.configure({ timeout: 120_000 });
  test('éditer une image génère une 2e image', async ({ page }) => {
    await signup(page, `pw-edit-${Date.now()}@test.invalid`);
    await page.goto('/media');
    // générer une image (stub)
    await page.getByRole('button', { name: '+ Ajouter une image' }).click();
    await page.getByRole('button', { name: "Générer avec l'IA" }).click();
    await page.getByLabel('Prompt').fill('un chat');
    await page.getByRole('button', { name: 'Générer', exact: true }).click();
    await expect(page.getByText('Image générée')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.grid > div')).toHaveCount(1);

    // éditer
    await page.getByRole('button', { name: 'Éditer (IA)' }).first().click();
    await page.getByPlaceholder(/fond en bleu/i).fill('rends-le bleu');
    await page.getByRole('button', { name: 'Éditer', exact: true }).click();
    await expect(page.getByText('Image éditée')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.grid > div')).toHaveCount(2);
  });
});
```

- [ ] **Step 2: E2E var image dans template**

`test/e2e/template-image-var.spec.ts` (copier les helpers) :

```ts
test.describe('Variable image dans template', () => {
  test.describe.configure({ timeout: 180_000 });
  test('template avec var image → attaché à un post', async ({ page }) => {
    await signup(page, `pw-tplimg-${Date.now()}@test.invalid`);

    // 1. générer une image dans la galerie (pour la piocher après)
    await page.goto('/media');
    await page.getByRole('button', { name: '+ Ajouter une image' }).click();
    await page.getByRole('button', { name: "Générer avec l'IA" }).click();
    await page.getByLabel('Prompt').fill('un fond abstrait');
    await page.getByRole('button', { name: 'Générer', exact: true }).click();
    await expect(page.getByText('Image générée')).toBeVisible({ timeout: 30_000 });

    // 2. créer un template avec une var image
    await page.goto('/settings/visual-templates/new');
    await page.getByLabel('Nom').fill('ImgTpl');
    await page.getByLabel('Slug').fill('imgtpl');
    await page.getByLabel('Width (px)').fill('600');
    await page.getByLabel('Height (px)').fill('400');
    await page.getByLabel('HTML (Handlebars)').fill('<img src="{{photo}}" width="600">');
    await page.getByLabel('CSS').fill('img { display:block }');
    await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
    await page.getByLabel('Name (identifiant Handlebars)').first().fill('photo');
    await page.getByLabel('Label (UI)').first().fill('Photo');
    // basculer le type en image
    await page.getByLabel('Type').first().click();
    await page.getByRole('option', { name: 'Image' }).click();
    await page.getByLabel('Sample vars (JSON, sert au preview)').fill('{}');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('ImgTpl').first()).toBeVisible();

    // 3. créer un post (stub Claude) + attacher le visuel via ce template
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Idée tpl image');
    await page.fill('textarea[name="brief"]', 'brief.');
    await page.click('button:has-text("Ajouter")');
    await page.locator('button:has-text("Générer un post")').first().click();
    await expect(page.locator('text=Post créé')).toBeVisible({ timeout: 30_000 });
    await page.goto('/posts');
    await page.locator('a').filter({ hasText: /Idée tpl image/i }).first().click();

    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'ImgTpl' }).click();
    // choisir l'image de la galerie pour la var photo
    await page.locator('button:has(img)').first().click();
    await page.getByRole('button', { name: /Valider et attacher/ }).click();
    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(page.locator('img[alt="Visuel du post"]')).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 3: Run new E2E (stubs)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null; npm run build 2>&1 | tail -2
CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e -- test/e2e/image-edit.spec.ts test/e2e/template-image-var.spec.ts 2>&1 | tail -15
```

Fix selector mismatches inline (notamment le sélecteur du Select type / option Image, et le picker d'image dans le formulaire de vars).

- [ ] **Step 4: Lint + format + tsc + full unit/int/worker**

```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

Expected: tout vert (warnings `<img>` tolérés).

- [ ] **Step 5: Commit**

```bash
git add test/e2e/image-edit.spec.ts test/e2e/template-image-var.spec.ts
git commit -m "🤖 test(spec-7): e2e var image dans template + édition IA"
```

---

## Task 9: Full E2E + push + PR

- [ ] **Step 1: Full E2E (no regression)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null
CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e 2>&1 | tail -12
```

Expected: tous verts (existants + 2 nouveaux). Re-run en solo tout test flaky (rate-limit signup) pour confirmer.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin spec-7/template-images-and-ai-edit
gh pr create --base main --head spec-7/template-images-and-ai-edit --title "spec 7: images dans templates + édition IA" --body "$(cat <<'EOF'
## Summary
- Variables image dans les templates (DSL union string|image) : le worker résout mediaId → URL signée R2, Puppeteer charge l'image au rendu
- Input image dans le formulaire de vars du post (galerie + ajouter upload/IA)
- Édition IA image-to-image depuis la galerie (Gemini editImage, nouvelle image, aiSourceKey)
- Storage simplifié : R2 dev+prod, InMemory tests, Filesystem E2E ; ajout download() à l'interface
- Zéro migration

Spec : docs/superpowers/specs/2026-05-24-spec-7-template-images-and-ai-edit-design.md
Plan : docs/superpowers/plans/2026-05-24-spec-7-template-images-and-ai-edit.md

## Test plan
- [ ] npm test (unit + integration + worker, Gemini/Puppeteer stubbés)
- [ ] CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 npm run test:e2e
- [ ] Smoke local (R2 réel) : template avec var image rendu, édition IA

## Notes
- Dev local utilise maintenant R2 (parité prod ; bucket dédié dev recommandé via R2_BUCKET). Filesystem cantonné à l'E2E.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI green, report URL. Ne pas merger sans Manu.**

```bash
gh run watch <run-id> --exit-status
```

---

## Critères de réussite globale

Cf. spec § Critères de réussite. Synthèse : var image dans template rendue depuis R2 ; édition IA crée une nouvelle image (aiSourceKey) ; storage R2 dev+prod / InMemory tests / Filesystem E2E ; `npm test` + `npm run test:e2e` verts ; lint + tsc clean ; CI verte ; PR ouverte (pas de merge auto).
