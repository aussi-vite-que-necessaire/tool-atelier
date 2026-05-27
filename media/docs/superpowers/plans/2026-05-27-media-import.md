# Plan d'implémentation — projet `media` (import v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ré-implémenter « Image Studio » dans l'atelier sous le projet `media` (Next.js), iso-fonctionnel avec la source Cloudflare, branché sur un Chromium partagé.

**Architecture:** Une app Next.js (base starter `flagship`) qui expose `/api/mcp` (connecteur claude.ai via BetterAuth) et `/v1/*` (API service Bearer). Stockage fichiers sur R2 via API S3, métadonnées sur Postgres (Drizzle), génération Gemini, rendu HTML via un conteneur browserless partagé (`puppeteer-core.connect`). Le cœur `store()` est partagé par les deux interfaces.

**Tech Stack:** Next.js 16, Drizzle + postgres-js, BetterAuth (`mcp` + `magicLink`), `mcp-handler` + `@modelcontextprotocol/sdk`, `@google/genai`, `puppeteer-core`, `@aws-sdk/client-s3`, `nanoid`, `zod`, vitest.

**Référence source (à porter) :** `~/Code/media-manager/` (lue ; les chemins `src/lib/*.ts` ci-dessous y réfèrent).

---

## Carte des fichiers (cible, dans `media/`)

| Fichier | Responsabilité |
|---|---|
| `lab.json` | `{ db, email, browser, migrate, seed }` |
| `src/lib/config.ts` | lecture centralisée de `process.env` (clés, BROWSER_URL, R2, prefix preview) |
| `src/lib/image-meta.ts` `tags.ts` `base64.ts` `ids.ts` `service-auth.ts` `url-guard.ts` | logique pure (portée verbatim) |
| `src/db/schema.ts` | tables BetterAuth + OAuth (mcp) + `images` |
| `src/lib/images/repository.ts` | CRUD `images` (Drizzle) — remplace `db.ts` |
| `src/lib/storage.ts` | adaptateur S3→R2 — remplace `r2.ts` |
| `src/lib/gemini.ts` | génération/édition (porté, env→config) |
| `src/lib/render.ts` | rendu HTML via browserless (porté de `browser.ts`, `launch`→`connect`) |
| `src/lib/store.ts` | cœur `store()` (porté, db/storage maison) |
| `src/lib/auth.ts` | BetterAuth + plugins `mcp()`+`magicLink()` |
| `src/lib/email.ts` | envoi Resend (magic-link) |
| `src/lib/mcp/{result,server,tools}.ts` | serveur MCP + 6 outils |
| `src/app/api/mcp/route.ts` | handler MCP (`mcp-handler`) |
| `src/app/api/auth/[...all]/route.ts` | BetterAuth |
| `src/app/.well-known/oauth-*/route.ts` | découverte OAuth |
| `src/app/sign-in/page.tsx` | login magic-link |
| `src/app/v1/[...route]/route.ts` | API service `/v1/*` |

Modifié hors `media/` : `scripts/deploy.sh`, `CLAUDE.md` (racine atelier).

---

## Task 1 : `deploy.sh` — injecter `BROWSER_URL` sur `browser: true`

**Files:**
- Modify: `scripts/deploy.sh` (bloc des besoins déclarés)
- Modify: `CLAUDE.md` (section Données — `lab.json`)

- [ ] **Step 1 : lire le bloc à modifier**

Dans `scripts/deploy.sh`, repérer le bloc Redis (`if [ "$REDIS" = "true" ]; then … fi`) et la lecture des besoins (`DB=…; REDIS=…; EMAIL=…`).

- [ ] **Step 2 : déclarer le besoin `browser`**

Modifier la ligne d'init et la lecture `jq` :

```bash
DB=false; REDIS=false; EMAIL=false; BROWSER=false; MIGRATE=""; SEED=""
if [ -f "$APPDIR/lab.json" ]; then
  DB="$(jq -r '.db // false' "$APPDIR/lab.json")"
  REDIS="$(jq -r '.redis // false' "$APPDIR/lab.json")"
  EMAIL="$(jq -r '.email // false' "$APPDIR/lab.json")"
  BROWSER="$(jq -r '.browser // false' "$APPDIR/lab.json")"
  MIGRATE="$(jq -r '.migrate // empty' "$APPDIR/lab.json")"
  SEED="$(jq -r '.seed // empty' "$APPDIR/lab.json")"
fi
```

- [ ] **Step 3 : injecter `BROWSER_URL`**

Juste après le bloc Redis, ajouter :

```bash
# Chromium partagé (browserless central sur le réseau lab) : URL CDP injectée
if [ "$BROWSER" = "true" ]; then
  # /opt/lab/platform/.env porte LAB_BROWSER_URL (ex. ws://browser:3000?token=…)
  LAB_BROWSER_URL=""
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  if [ -n "${LAB_BROWSER_URL:-}" ]; then
    printf 'BROWSER_URL=%s\n' "$LAB_BROWSER_URL" >> "$APPDIR/.env"
  else
    echo "⚠ browser: true mais LAB_BROWSER_URL absent de /opt/lab/platform/.env (skip) — provisionner browserless."
  fi
fi
```

- [ ] **Step 4 : documenter la convention**

Dans `CLAUDE.md` (racine), section « Données — `lab.json` », ajouter à la phrase décrivant les clés :
`browser: true` → `BROWSER_URL` (Chromium partagé browserless, central sur le réseau `lab`).

- [ ] **Step 5 : vérifier**

Run: `bash -n scripts/deploy.sh`
Expected: aucune sortie (syntaxe OK).

- [ ] **Step 6 : commit**

```bash
git add scripts/deploy.sh CLAUDE.md
git commit -m "🤖 deploy: injecter BROWSER_URL sur browser:true (Chromium partagé)"
```

---

## Task 2 : scaffolder `media` depuis `flagship`

**Files:**
- Create: `media/` (copie de `starters/flagship`)
- Modify: `media/lab.json`, `media/package.json`, `media/CLAUDE.md`, `media/.env.example`

- [ ] **Step 1 : copier le starter**

```bash
cp -r starters/flagship media
rm -rf media/node_modules media/.next
```

- [ ] **Step 2 : `media/lab.json`**

```json
{ "description": "media (media.lab.avqn.ch) — génération/édition d'image (Gemini), rendu HTML→image (Chromium partagé), API MCP + /v1.", "db": true, "email": true, "browser": true, "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs" }
```

- [ ] **Step 3 : `media/package.json`**

Mettre `"name": "media"` et ajouter aux `dependencies` :

```json
"@aws-sdk/client-s3": "^3.700.0",
"@google/genai": "^2.6.0",
"@modelcontextprotocol/sdk": "^1.26.0",
"mcp-handler": "^1.1.0",
"nanoid": "^5.1.11",
"puppeteer-core": "^24.0.0",
"resend": "^6.12.3",
"zod": "^4.4.3"
```

Ajouter aux `devDependencies` : `"vitest": "^4.1.7"`. Ajouter au bloc `scripts` : `"test": "vitest run"`.

- [ ] **Step 4 : installer + baseline**

Run: `cd media && npm install && npm run build`
Expected: build Next standalone OK (pas de DATABASE_URL requis au build).

- [ ] **Step 5 : adapter `media/CLAUDE.md`**

Réécrire l'entête pour décrire `media` (but, interfaces `/api/mcp` + `/v1`, dépendances db/email/browser, stockage R2). Garder les sections « Commandes » et conventions du flagship.

- [ ] **Step 6 : commit**

```bash
git add media
git commit -m "🤖 media: scaffold depuis flagship (lab.json db+email+browser, deps)"
```

---

## Task 3 : porter la logique pure + tests

**Files:**
- Create: `media/src/lib/{image-meta,tags,base64,ids,service-auth,url-guard}.ts`
- Create: `media/src/lib/config.ts`
- Test: `media/test/{image-meta,tags,base64,service-auth,url-guard}.test.ts`

- [ ] **Step 1 : copier les modules purs verbatim**

Copier depuis `~/Code/media-manager/src/lib/` vers `media/src/lib/`, **sans modification** :
`image-meta.ts`, `tags.ts`, `base64.ts`, `ids.ts`. (Node 22 fournit `atob`/`btoa` globaux → `base64.ts` fonctionne tel quel.)

- [ ] **Step 2 : `service-auth.ts` (env→process.env)**

Copier `~/Code/media-manager/src/lib/service-auth.ts` puis remplacer la signature qui prend `env: Env` par une lecture directe :

```typescript
export function checkServiceKey(request: Request): boolean {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  return constantTimeEqual(provided, process.env.MEDIA_ENGINE_SERVICE_KEY ?? "");
}
```

(garder `constantTimeEqual` inchangé.)

- [ ] **Step 3 : `url-guard.ts` verbatim**

Copier `~/Code/media-manager/src/lib/url-guard.ts` sans modification.

- [ ] **Step 4 : `config.ts`**

```typescript
// Lecture centralisée des variables runtime (injectées par la plateforme + secrets).
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export const config = {
  geminiApiKey: () => required("GEMINI_API_KEY"),
  browserUrl: () => required("BROWSER_URL"),
  r2: () => ({
    endpoint: required("R2_S3_ENDPOINT"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucket: required("R2_BUCKET"),
    publicBaseUrl: required("R2_PUBLIC_BASE_URL"),
  }),
  // Préfixe de clés R2 : vide en prod, "<env>/" sinon → isole les écritures de preview.
  keyPrefix: () => {
    const env = process.env.APP_ENV ?? "dev";
    return env === "prod" ? "" : `${env}/`;
  },
};
```

- [ ] **Step 5 : porter les tests purs**

Copier depuis `~/Code/media-manager/test/` vers `media/test/` : `image-meta.test.ts`, `tags.test.ts`, `base64.test.ts`, `url-guard.test.ts`. Pour `service-auth.test.ts`, adapter les appels (plus de param `env` ; poser `process.env.MEDIA_ENGINE_SERVICE_KEY` dans le test).

- [ ] **Step 6 : lancer les tests**

Run: `cd media && npx vitest run test/`
Expected: PASS (tous les tests de logique pure).

- [ ] **Step 7 : commit**

```bash
git add media/src/lib media/test
git commit -m "🤖 media: logique pure portée (image-meta, tags, base64, ids, service-auth, url-guard) + tests"
```

---

## Task 4 : table `images` (Drizzle) + repository Postgres

**Files:**
- Modify: `media/src/db/schema.ts` (ajout table `images`)
- Create: `media/src/lib/images/repository.ts`
- Create: `media/drizzle/0001_images.sql` (généré)
- Test: `media/test/images-repository.test.ts` (logique de filtrage)

- [ ] **Step 1 : ajouter la table `images` au schéma**

Dans `media/src/db/schema.ts`, ajouter (et l'exporter dans `schema`) :

```typescript
import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const images = pgTable(
  "images",
  {
    id: text("id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    prompt: text("prompt"),
    parentId: text("parent_id"),
    source: text("source").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    width: integer("width"),
    height: integer("height"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_images_created").on(t.createdAt),
    index("idx_images_parent").on(t.parentId),
    index("idx_images_source").on(t.source),
  ],
);
```

Ajouter `images` à l'objet `schema` exporté en bas du fichier.

- [ ] **Step 2 : type partagé `ImageRecord`**

Créer `media/src/lib/images/types.ts` :

```typescript
export type ImageSource = "gemini_generate" | "gemini_edit" | "html_render" | "upload";

export interface ImageRecord {
  id: string;
  r2_key: string;
  url: string;
  prompt: string | null;
  parent_id: string | null;
  source: ImageSource;
  tags: string[];
  width: number | null;
  height: number | null;
  created_at: number; // unix ms
}
```

- [ ] **Step 3 : repository (Drizzle)**

Créer `media/src/lib/images/repository.ts` :

```typescript
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";
import { clampLimit } from "@/lib/tags";
import type { ImageRecord, ImageSource } from "./types";

type Row = typeof images.$inferSelect;

function toRecord(r: Row): ImageRecord {
  return {
    id: r.id,
    r2_key: r.r2Key,
    url: r.url,
    prompt: r.prompt,
    parent_id: r.parentId,
    source: r.source as ImageSource,
    tags: r.tags ?? [],
    width: r.width,
    height: r.height,
    created_at: r.createdAt.getTime(),
  };
}

export async function insertImage(rec: ImageRecord): Promise<void> {
  await db.insert(images).values({
    id: rec.id,
    r2Key: rec.r2_key,
    url: rec.url,
    prompt: rec.prompt,
    parentId: rec.parent_id,
    source: rec.source,
    tags: rec.tags,
    width: rec.width,
    height: rec.height,
    createdAt: new Date(rec.created_at),
  });
}

export async function getImageRecord(id: string): Promise<ImageRecord | null> {
  const [row] = await db.select().from(images).where(eq(images.id, id)).limit(1);
  return row ? toRecord(row) : null;
}

export async function deleteImageRow(id: string): Promise<boolean> {
  const deleted = await db.delete(images).where(eq(images.id, id)).returning({ id: images.id });
  return deleted.length > 0;
}

export interface ListParams {
  query?: string;
  tags?: string[];
  source?: ImageSource;
  limit?: number;
}

export async function listImageRecords(params: ListParams): Promise<ImageRecord[]> {
  const conds = [];
  if (params.query) conds.push(ilike(images.prompt, `%${params.query}%`));
  if (params.source) conds.push(eq(images.source, params.source));
  // jsonb @> : toutes les tags requises présentes (intersection, en SQL).
  if (params.tags?.length) conds.push(sqlHasAllTags(params.tags));

  const rows = await db
    .select()
    .from(images)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(images.createdAt))
    .limit(clampLimit(params.limit));
  return rows.map(toRecord);
}
```

Ajouter en haut le helper `sqlHasAllTags` (jsonb contient) :

```typescript
import { sql } from "drizzle-orm";
function sqlHasAllTags(tags: string[]) {
  return sql`${images.tags} @> ${JSON.stringify(tags)}::jsonb`;
}
```

(Supprimer l'import `inArray` s'il n'est pas utilisé.)

- [ ] **Step 4 : générer la migration**

Run: `cd media && npx drizzle-kit generate`
Expected: un fichier `drizzle/0001_*.sql` créé contenant `CREATE TABLE "images"` + index.

- [ ] **Step 5 : commit**

```bash
git add media/src/db/schema.ts media/src/lib/images media/drizzle
git commit -m "🤖 media: table images (Drizzle, jsonb tags) + repository Postgres"
```

---

## Task 5 : adaptateur stockage S3→R2

**Files:**
- Create: `media/src/lib/storage.ts`

- [ ] **Step 1 : implémenter l'adaptateur**

Créer `media/src/lib/storage.ts` :

```typescript
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "./config";

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  const r2 = config.r2();
  _client = new S3Client({
    region: "auto",
    endpoint: r2.endpoint,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
  return _client;
}

// Clé complète avec préfixe d'environnement (isole les écritures de preview).
export function objectKey(id: string, ext: string): string {
  return `${config.keyPrefix()}images/${id}.${ext}`;
}

export async function putImage(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const r2 = config.r2();
  await client().send(new PutObjectCommand({
    Bucket: r2.bucket, Key: key, Body: bytes, ContentType: contentType,
  }));
}

export function publicUrl(key: string): string {
  return `${config.r2().publicBaseUrl.replace(/\/$/, "")}/${key}`;
}

export interface FetchedObject { bytes: Uint8Array; contentType: string; }

export async function getImageBytes(key: string): Promise<FetchedObject | null> {
  const r2 = config.r2();
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    const bytes = new Uint8Array(await res.Body!.transformToByteArray());
    return { bytes, contentType: res.ContentType ?? "image/png" };
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const r2 = config.r2();
  await client().send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));
}
```

- [ ] **Step 2 : typecheck**

Run: `cd media && npx tsc --noEmit`
Expected: pas d'erreur sur `storage.ts`.

- [ ] **Step 3 : commit**

```bash
git add media/src/lib/storage.ts
git commit -m "🤖 media: adaptateur stockage S3→R2 (+ préfixe de clés preview)"
```

---

## Task 6 : adaptateur Gemini

**Files:**
- Create: `media/src/lib/gemini.ts`

- [ ] **Step 1 : porter `gemini.ts`**

Copier `~/Code/media-manager/src/lib/gemini.ts` vers `media/src/lib/gemini.ts`, puis :
- supprimer `import type { Env }` ; remplacer les paramètres `env: Env` par rien et lire la clé via `config.geminiApiKey()` ;
- importer `import { config } from "./config";` et `import { base64ToBytes, bytesToBase64 } from "./base64";`.

Signatures cibles :

```typescript
export async function generateImage(prompt: string, aspectRatio: string): Promise<GeminiImageResult>
export async function editImage(sourceBytes: Uint8Array, sourceMime: string, editPrompt: string): Promise<GeminiImageResult>
```

À l'intérieur : `const ai = new GoogleGenAI({ apiKey: config.geminiApiKey() });` (le reste — `extractImage`, modèle `gemini-3-pro-image-preview`, config `responseModalities`/`imageConfig` — inchangé).

- [ ] **Step 2 : typecheck**

Run: `cd media && npx tsc --noEmit`
Expected: pas d'erreur sur `gemini.ts`.

- [ ] **Step 3 : commit**

```bash
git add media/src/lib/gemini.ts
git commit -m "🤖 media: adaptateur Gemini (porté, clé via config)"
```

---

## Task 7 : adaptateur rendu HTML (browserless)

**Files:**
- Create: `media/src/lib/render.ts`

- [ ] **Step 1 : porter `browser.ts` en `connect`**

Créer `media/src/lib/render.ts` à partir de `~/Code/media-manager/src/lib/browser.ts`, avec ces changements :
- `import puppeteer, { type ScreenshotOptions } from "puppeteer-core";`
- `import { config } from "./config";`
- supprimer le param `env: Env` de `renderHtml` ;
- remplacer `const browser = await puppeteer.launch(env.BROWSER);` par `const browser = await puppeteer.connect({ browserWSEndpoint: config.browserUrl() });`
- remplacer `await browser.close();` par `await browser.disconnect();` (on ne ferme pas le navigateur partagé, on se déconnecte).

Le reste (interception anti-SSRF via `isBlockedUrl`, `setViewport`, `setContent` `networkidle0`, `waitFor`, `screenshot` avec `clip`, `MAX_WAIT_MS`) est **inchangé**. Importer `isBlockedUrl` depuis `./url-guard` et `mimeForFormat`/`RenderFormat` depuis `./image-meta`.

Signature cible :

```typescript
export async function renderHtml(opts: RenderOptions): Promise<{ bytes: Uint8Array; mimeType: string }>
```

- [ ] **Step 2 : typecheck**

Run: `cd media && npx tsc --noEmit`
Expected: pas d'erreur sur `render.ts`.

- [ ] **Step 3 : commit**

```bash
git add media/src/lib/render.ts
git commit -m "🤖 media: rendu HTML via browserless partagé (puppeteer-core connect)"
```

---

## Task 8 : cœur `store()`

**Files:**
- Create: `media/src/lib/store.ts`

- [ ] **Step 1 : implémenter `store()`**

Créer `media/src/lib/store.ts` (porté de la source, sans `env`, utilisant repository + storage maison) :

```typescript
import { newId } from "./ids";
import { extensionForMime, parseImageDimensions } from "./image-meta";
import { objectKey, publicUrl, putImage, deleteObject } from "./storage";
import { insertImage } from "./images/repository";
import type { ImageRecord, ImageSource } from "./images/types";

export interface StoreInput {
  bytes: Uint8Array;
  mimeType: string;
  prompt: string | null;
  parent_id: string | null;
  source: ImageSource;
  tags: string[];
  width?: number;
  height?: number;
}

export async function store(input: StoreInput): Promise<ImageRecord> {
  const id = newId();
  const ext = extensionForMime(input.mimeType);
  const key = objectKey(id, ext);

  await putImage(key, input.bytes, input.mimeType);

  const dims =
    input.width && input.height
      ? { width: input.width, height: input.height }
      : parseImageDimensions(input.bytes) ?? { width: null, height: null };

  const record: ImageRecord = {
    id,
    r2_key: key,
    url: publicUrl(key),
    prompt: input.prompt,
    parent_id: input.parent_id,
    source: input.source,
    tags: input.tags,
    width: dims.width,
    height: dims.height,
    created_at: Date.now(),
  };

  try {
    await insertImage(record);
  } catch (err) {
    await deleteObject(key).catch(() => {}); // compensation : pas d'objet orphelin
    throw err;
  }
  return record;
}
```

- [ ] **Step 2 : typecheck**

Run: `cd media && npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 3 : commit**

```bash
git add media/src/lib/store.ts
git commit -m "🤖 media: cœur store() (R2 + Postgres, compensation orphelin)"
```

---

## Task 9 : API `/v1` (Bearer)

**Files:**
- Create: `media/src/lib/v1/router.ts` (logique pure de routage testable)
- Create: `media/src/app/v1/[...route]/route.ts` (handler Next)
- Test: `media/test/v1-router.test.ts`

- [ ] **Step 1 : test du routage + auth (échoue d'abord)**

Créer `media/test/v1-router.test.ts` :

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { handleV1 } from "@/lib/v1/router";

beforeEach(() => { process.env.MEDIA_ENGINE_SERVICE_KEY = "k-test"; });

function req(path: string, method = "POST", auth = "Bearer k-test", body?: unknown) {
  return new Request(`https://m.test${path}`, {
    method,
    headers: { Authorization: auth, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("handleV1", () => {
  it("401 sans clé valide", async () => {
    const res = await handleV1(req("/v1/generate", "POST", "Bearer wrong", { prompt: "x" }));
    expect(res.status).toBe(401);
  });
  it("404 route inconnue", async () => {
    const res = await handleV1(req("/v1/nope"));
    expect(res.status).toBe(404);
  });
  it("400 corps invalide sur generate", async () => {
    const res = await handleV1(req("/v1/generate", "POST", "Bearer k-test", {}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2 : lancer → échoue**

Run: `cd media && npx vitest run test/v1-router.test.ts`
Expected: FAIL (`handleV1` non défini).

- [ ] **Step 3 : implémenter le routeur**

Créer `media/src/lib/v1/router.ts` en portant `~/Code/media-manager/src/v1.ts` avec ces adaptations :
- `import { checkServiceKey } from "@/lib/service-auth";` (sans `env`)
- `generateImage`/`editImage` depuis `@/lib/gemini` (sans `env`), `renderHtml` depuis `@/lib/render`, `store` depuis `@/lib/store`, `getImageBytes`/`deleteObject` depuis `@/lib/storage`, `getImageRecord`/`deleteImageRow` depuis `@/lib/images/repository`
- les schémas Zod `GenerateSchema`/`EditSchema`/`RenderHtmlSchema` et la fonction `jsonResponse` : **inchangés**
- signature cible : `export async function handleV1(request: Request): Promise<Response>` ; remplacer la garde par `if (!checkServiceKey(request)) return jsonResponse({ error: "Unauthorized" }, 401);`
- les handlers `handleGenerate`/`handleEdit`/`handleRenderHtml`/`handleUpload`/`handleDelete` : mêmes corps, en retirant `env` des appels (ex. `generateImage(composed, aspectRatio)`, `store({...})`, `getImageRecord(sourceId)`, `getImageBytes(source.r2_key)`).

- [ ] **Step 4 : lancer → passe**

Run: `cd media && npx vitest run test/v1-router.test.ts`
Expected: PASS.

- [ ] **Step 5 : handler Next**

Créer `media/src/app/v1/[...route]/route.ts` :

```typescript
import { handleV1 } from "@/lib/v1/router";

export const dynamic = "force-dynamic";

export const POST = (req: Request) => handleV1(req);
export const DELETE = (req: Request) => handleV1(req);
```

- [ ] **Step 6 : commit**

```bash
git add media/src/lib/v1 media/src/app/v1 media/test/v1-router.test.ts
git commit -m "🤖 media: API /v1 (generate/edit/render-html/upload/delete, Bearer) + tests routeur"
```

---

## Task 10 : BetterAuth — connecteur OAuth (mcp + magic-link)

**Files:**
- Modify: `media/src/lib/auth.ts`, `media/src/lib/auth-client.ts`
- Create: `media/src/lib/email.ts`
- Create: `media/src/app/.well-known/oauth-authorization-server/route.ts`
- Create: `media/src/app/.well-known/oauth-protected-resource/route.ts`
- Create: `media/src/app/sign-in/page.tsx`
- Modify: `media/src/db/schema.ts` (tables OAuth générées), `media/drizzle/*`

- [ ] **Step 1 : email Resend**

Créer `media/src/lib/email.ts` :

```typescript
import { Resend } from "resend";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  if (!apiKey) throw new Error("RESEND_API_KEY manquant");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
}
```

- [ ] **Step 2 : configurer BetterAuth**

Réécrire `media/src/lib/auth.ts` :

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, mcp } from "better-auth/plugins";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  plugins: [
    magicLink({
      expiresIn: 600,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Connexion à media",
          html: `<p>Connexion : <a href="${url}">${url}</a></p><p>Lien valable 10 minutes.</p>`,
        });
      },
    }),
    mcp({ loginPage: "/sign-in", oidcConfig: { loginPage: "/sign-in", allowDynamicClientRegistration: true, requirePKCE: true } }),
  ],
});
```

- [ ] **Step 3 : générer le schéma OAuth + migration**

Run: `cd media && npx @better-auth/cli@latest generate --output src/db/schema.ts -y`
Expected: `src/db/schema.ts` complété avec les tables BetterAuth + OAuth (`oauthApplication`, `oauthAccessToken`, `oauthConsent`, verification mise à jour). Vérifier que `images` (Task 4) **reste présent** et ré-ajouter au besoin ; ré-exporter `schema` avec toutes les tables.

Puis : `npx drizzle-kit generate`
Expected: une migration SQL pour les tables OAuth.

- [ ] **Step 4 : routes de découverte**

Créer `media/src/app/.well-known/oauth-authorization-server/route.ts` :

```typescript
import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";
export const GET = oAuthDiscoveryMetadata(auth);
```

Créer `media/src/app/.well-known/oauth-protected-resource/route.ts` :

```typescript
import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";
export const GET = oAuthProtectedResourceMetadata(auth);
```

- [ ] **Step 5 : client auth (magic-link)**

Réécrire `media/src/lib/auth-client.ts` :

```typescript
"use client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 6 : page de login magic-link**

Créer `media/src/app/sign-in/page.tsx` (Tailwind brut, sans dépendance UI ; calqué sur le flux contentos avec `callbackURL: "/"`, c.-à-d. BetterAuth reprend la requête OAuth en attente après authentification) :

```tsx
"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
      if (error) setError(error.message ?? "Erreur lors de l'envoi du lien");
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Connexion à media</h1>
      {sent ? (
        <p className="text-sm text-gray-600">Lien envoyé à {email}. Vérifie ta boîte mail (valable 10 min).</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            disabled={loading}
            className="rounded border px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading || !email} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
            {loading ? "Envoi…" : "Recevoir le lien"}
          </button>
        </form>
      )}
    </main>
  );
}
```

Renuméroter les steps suivants de cette tâche (typecheck/build → Step 7, commit → Step 8).

- [ ] **Step 6 : typecheck + build**

Run: `cd media && npx tsc --noEmit && npm run build`
Expected: OK.

- [ ] **Step 7 : commit**

```bash
git add media/src/lib/auth.ts media/src/lib/email.ts media/src/app/.well-known media/src/app/sign-in media/src/db/schema.ts media/drizzle
git commit -m "🤖 media: connecteur OAuth BetterAuth (mcp + magic-link) + découverte"
```

---

## Task 11 : serveur MCP + 6 outils

**Files:**
- Create: `media/src/lib/mcp/result.ts`
- Create: `media/src/lib/mcp/server.ts`
- Create: `media/src/lib/mcp/auth.ts`
- Create: `media/src/app/api/mcp/route.ts`
- Test: `media/test/mcp-server.test.ts`

- [ ] **Step 1 : helpers de résultat**

Créer `media/src/lib/mcp/result.ts` :

```typescript
import { bytesToBase64 } from "@/lib/base64";

type Block = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function imageResult(bytes: Uint8Array, mimeType: string, meta: unknown) {
  return {
    content: [
      { type: "image" as const, data: bytesToBase64(bytes), mimeType },
      { type: "text" as const, text: JSON.stringify(meta) },
    ] satisfies Block[],
  };
}
```

- [ ] **Step 2 : garde d'auth MCP**

Créer `media/src/lib/mcp/auth.ts` (calqué sur contentos) :

```typescript
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { auth } from "@/lib/auth";

export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? "media-mcp",
    scopes: typeof session.scopes === "string" ? session.scopes.split(" ").filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}
```

- [ ] **Step 3 : serveur MCP + outils**

Créer `media/src/lib/mcp/server.ts` en portant `~/Code/media-manager/src/tools.ts`, avec :
- `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";` + `import { z } from "zod";`
- imports des fonctions cœur sans `env` : `generateImage`/`editImage` (`@/lib/gemini`), `renderHtml` (`@/lib/render`), `store` (`@/lib/store`), `getImageRecord`/`listImageRecords`/`deleteImageRow` (`@/lib/images/repository`), `getImageBytes`/`deleteObject` (`@/lib/storage`)
- `import { jsonResult, imageResult } from "./result";`
- exporter `export function registerAllTools(server: McpServer): void { … }` qui enregistre les **6 outils** (`generate_image`, `edit_image`, `render_html`, `list_images`, `get_image`, `delete_image`) avec **exactement les mêmes** schémas Zod, descriptions et `INSTRUCTIONS` que la source ; chaque handler appelle les fonctions cœur sans `env` (ex. `await generateImage(prompt, aspect_ratio ?? "1:1")`, `await store({...})`).

- [ ] **Step 4 : test d'enregistrement des outils (échoue d'abord)**

Créer `media/test/mcp-server.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "@/lib/mcp/server";

describe("registerAllTools", () => {
  it("enregistre les 6 outils attendus", () => {
    const server = new McpServer({ name: "media", version: "1" });
    registerAllTools(server);
    const names = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    expect(names.sort()).toEqual(
      ["delete_image", "edit_image", "generate_image", "get_image", "list_images", "render_html"].sort(),
    );
  });
});
```

- [ ] **Step 5 : lancer → passe**

Run: `cd media && npx vitest run test/mcp-server.test.ts`
Expected: PASS (sinon, ajuster l'accès au registre interne selon la version du SDK).

- [ ] **Step 6 : handler MCP**

Créer `media/src/app/api/mcp/route.ts` :

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerAllTools } from "@/lib/mcp/server";

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: "media", version: "1" } },
  { basePath: "/api" },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 7 : build complet**

Run: `cd media && npx tsc --noEmit && npm run build`
Expected: OK.

- [ ] **Step 8 : commit**

```bash
git add media/src/lib/mcp media/src/app/api/mcp media/test/mcp-server.test.ts
git commit -m "🤖 media: serveur MCP + 6 outils (porté), handler /api/mcp"
```

---

## Task 12 : seed, secrets, déploiement preview, vérification

**Files:**
- Modify: `media/scripts/seed.mjs` (no-op sûr)
- Modify: `media/.env.example`

- [ ] **Step 1 : seed neutre**

S'assurer que `media/scripts/seed.mjs` est idempotent et ne crée pas de données (le user est créé au premier login magic-link). Laisser un seed vide/log si rien à faire.

- [ ] **Step 2 : `.env.example`**

Compléter `media/.env.example` avec les variables à fournir (hors auto-injectées) :

```
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GEMINI_API_KEY=
MEDIA_ENGINE_SERVICE_KEY=
R2_S3_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=image-studio
R2_PUBLIC_BASE_URL=
# Auto-injectées par la plateforme : DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, BROWSER_URL
```

- [ ] **Step 3 : poser les secrets (`/lab-secret`, scope `media`)**

Via la skill `/lab-secret` : `BETTER_AUTH_SECRET` (aléatoire fort), `GEMINI_API_KEY`, `MEDIA_ENGINE_SERVICE_KEY` (aléatoire fort), `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`. `BETTER_AUTH_URL` = `https://media.lab.avqn.ch` (prod) — fournir aussi côté preview.

- [ ] **Step 4 : prérequis plateforme**

Vérifier que browserless est provisionné (`LAB_BROWSER_URL` dans `/opt/lab/platform/.env`). Sinon, le rendu HTML échouera en preview (cf. spec §5/§13).

- [ ] **Step 5 : commit + push + preview**

```bash
git add media/scripts/seed.mjs media/.env.example
git commit -m "🤖 media: seed neutre + .env.example"
git push -u origin HEAD
```

Suivre la CI (`gh run watch`) → preview `https://media-<branche>.lab.avqn.ch`.

- [ ] **Step 6 : vérifier iso-fonctionnel sur la preview**

- `/healthz` répond `ok`.
- `/v1/generate` (Bearer) renvoie `{ id, url, width, height }` et l'URL R2 est accessible.
- `/v1/render-html` renvoie une image (valide le Chromium partagé).
- Connecteur MCP : ajouter `https://media-<branche>.lab.avqn.ch/mcp` dans claude.ai, login magic-link, appeler `generate_image` puis `list_images`.

- [ ] **Step 7 : PR**

Ouvrir la PR (`gh pr create`), titre « ✨ nouveau projet media (import Image Studio) ». Le merge déploiera la prod `media.lab.avqn.ch` ; ré-enregistrer alors le connecteur claude.ai sur l'URL de prod (spec §10).

---

## Auto-revue (à exécuter après rédaction)

- **Couverture spec** : §4 archi (Tasks 2-11) · §5 Chromium (Task 1 + 7) · §6 composants (Tasks 3-11) · §7 données (Task 4) · §8 interfaces MCP+/v1 (Tasks 9, 11) · §9 auth (Tasks 9, 10) · §10 mise en service (Task 12) · §12 tests (Tasks 3, 9, 11). La **promotion `starters/mcp`** (spec §11) est le **plan 2**, écrit après ce plan.
- **Cohérence des types** : `ImageRecord`/`ImageSource` définis Task 4, réutilisés Tasks 8/9/11 ; `store()` signature Task 8 = appels Tasks 9/11 ; `handleV1` Task 9 = handler Task 9 Step 5.
