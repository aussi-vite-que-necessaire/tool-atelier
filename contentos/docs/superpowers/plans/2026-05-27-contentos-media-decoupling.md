# ContentOS — découplage média — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retirer toute la création de média de ContentOS (génération, templates, styles, chartes, PDF, upload) ; un post référence un média du service `media` ; attache via picker UI + MCP `attach_media_to_post` ; publication LinkedIn via fetch de l'URL. Ajouter au passage une petite API lecture `/v1` à `media` pour le picker.

**Architecture:** Deux phases dans deux dépôts/worktrees/PR. **Phase A — `media`** : `GET /v1/media` (liste filtrable paginée) + `GET /v1/media/:id`, déployée en prod d'abord. **Phase B — `contentos`** : référence média par colonnes sur `posts`, suppression des tables/code/queues/outils/UI de création média, client lecture `media-catalog`, picker, repointage `MEDIA_ENGINE_URL` → media prod, migration des références.

**Tech Stack:** Next.js 16, Drizzle (node-postgres), BetterAuth MCP, BullMQ, zod, vitest.

**Spec :** `contentos/docs/superpowers/specs/2026-05-27-contentos-media-decoupling-design.md`.

**Worktrees :**
- Phase A : worktree `media` dédié (branche `work/media-readapi`). `media.lab.avqn.ch` après merge.
- Phase B : worktree courant `work/contentos-media-decouple` (contentos).

**Conventions :** 2 espaces, fonctions déclarées, commentaires FR. `npx tsc --noEmit` + `npm test` (vitest, dans `contentos/` ou `media/`) avant chaque commit. Migrations Drizzle **idempotentes** + `when` du journal **croissants** (la base preview persiste entre déploiements). Commits sur la branche du worktree (jamais main).

---

# PHASE A — `media` : API lecture `/v1` (worktree media, PR séparée, merge prod en premier)

Référence (worktree media) : `media/src/lib/media/repository.ts` (`listMediaRecords`, `getMediaRecord`, `MediaRecord`/`MediaKind`), `media/src/lib/v1/router.ts` (`handleV1`, `jsonResponse`, `checkServiceKey`), `media/src/app/v1/[...route]/route.ts` (n'expose que POST/DELETE), `media/test/v1-router.test.ts`.

## Task A1 : `listMediaRecords` — pagination + orientation

**Files:**
- Modify: `media/src/lib/media/repository.ts` (`ListParams` + `listMediaRecords`)
- Test: `media/test/media-list-params.test.ts`

- [ ] **Step 1 : test de l'helper d'orientation (échec)**

Créer dans `repository.ts` un helper pur exporté `orientationCond(orientation)` n'est pas idéal (dépend de drizzle). À la place, tester la **dérivation** via une fonction pure `orientationBounds`. `media/test/media-list-params.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { orientationRatio } from "@/lib/media/repository";

describe("orientationRatio", () => {
  it("classe paysage/portrait/carré par ratio w/h", () => {
    expect(orientationRatio(1600, 900)).toBe("landscape");
    expect(orientationRatio(1080, 1920)).toBe("portrait");
    expect(orientationRatio(1000, 1000)).toBe("square");
    expect(orientationRatio(1000, 1040)).toBe("square"); // tolérance ±5%
  });
});
```

- [ ] **Step 2 : lancer (échec)** — `cd media && npx vitest run test/media-list-params.test.ts`

- [ ] **Step 3 : implémenter**

Dans `repository.ts`, ajouter :
```ts
export type Orientation = "landscape" | "portrait" | "square";

// Classe une orientation à partir des dimensions (tolérance ±5% pour le carré).
export function orientationRatio(width: number, height: number): Orientation {
  if (!width || !height) return "square";
  const r = width / height;
  if (r > 1.05) return "landscape";
  if (r < 0.95) return "portrait";
  return "square";
}
```
Étendre `ListParams` : ajouter `offset?: number`, `orientation?: Orientation`. Dans `listMediaRecords` : appliquer `offset` via `.offset(params.offset ?? 0)`, et pour l'orientation, filtrer en SQL sur le ratio :
- `landscape` : `sql\`${media.width}::float / ${media.height} > 1.05\``
- `portrait` : `sql\`${media.width}::float / ${media.height} < 0.95\``
- `square` : entre 0.95 et 1.05.
Garder le tri `desc(createdAt)`. Ajouter aussi une fonction `countMediaRecords(params)` qui réutilise les mêmes `conds` et renvoie `select({ c: count() })` (pour `total`). `q` (param `query`) couvre déjà `prompt` ; étendre pour aussi matcher un tag : `or(ilike(prompt,...), sqlHasAllTags-like)` — simplest : si `query`, `or(ilike(media.prompt, %q%), sql\`${media.tags}::text ilike ${'%'+q+'%'}\`)`.

- [ ] **Step 4 : lancer (succès)** — PASS.

- [ ] **Step 5 : tsc + commit**
```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: listMediaRecords — pagination (offset) + filtre orientation + recherche tags"
```

## Task A2 : routes `GET /v1/media` et `GET /v1/media/:id`

**Files:**
- Modify: `media/src/lib/v1/router.ts` (handlers + routage GET)
- Modify: `media/src/app/v1/[...route]/route.ts` (exporter `GET`)
- Test: `media/test/v1-media-read.test.ts`

- [ ] **Step 1 : handlers + routage**

Dans `router.ts`, ajouter :
```ts
import { listMediaRecords, countMediaRecords, type Orientation } from "@/lib/media/repository";

async function handleListMedia(url: URL): Promise<Response> {
  const p = url.searchParams;
  const kind = p.get("kind") as ("image"|"video"|"pdf"|"render"|null);
  const orientation = p.get("orientation") as (Orientation | null);
  const limit = Math.min(Math.max(Number(p.get("limit") ?? 30), 1), 100);
  const offset = Math.max(Number(p.get("offset") ?? 0), 0);
  const params = {
    query: p.get("q") || undefined,
    tags: p.get("tag") ? [p.get("tag")!] : undefined,
    kind: kind ?? undefined,
    orientation: orientation ?? undefined,
    limit, offset,
  };
  const [items, total] = await Promise.all([listMediaRecords(params), countMediaRecords(params)]);
  const view = items.map((r) => ({ id: r.id, url: r.url, kind: r.kind, width: r.width, height: r.height, prompt: r.prompt, tags: r.tags, created_at: r.created_at }));
  return jsonResponse({ items: view, total, limit, offset });
}

async function handleGetMedia(id: string): Promise<Response> {
  const rec = await getMediaRecord(id);
  if (!rec) return jsonResponse({ error: "Média introuvable" }, 404);
  return jsonResponse({ id: rec.id, url: rec.url, kind: rec.kind, width: rec.width, height: rec.height, prompt: rec.prompt, tags: rec.tags, created_at: rec.created_at });
}
```
Dans `handleV1`, avant le 404 final :
```ts
if (method === "GET" && pathname === "/v1/media") return handleListMedia(url);
const getMatch = pathname.match(/^\/v1\/media\/([^/]+)$/);
if (method === "GET" && getMatch) return handleGetMedia(getMatch[1]);
```

- [ ] **Step 2 : exposer GET dans la route Next**

`media/src/app/v1/[...route]/route.ts` : ajouter `export const GET = (req: Request) => handleV1(req);`

- [ ] **Step 3 : test du routage lecture (échec puis succès)**

`media/test/v1-media-read.test.ts` — sans DB : tester que sans Bearer → 401, et que le parsing des query params est correct via un appel à `handleListMedia`-like est difficile sans DB. **Tester plutôt l'auth + le 404 de forme** : appeler `handleV1(new Request("https://x/v1/media", { headers: {...} }))` sans clé → 401. Pour la logique DB, validation sur preview. Garder un test minimal :
```ts
import { describe, it, expect } from "vitest";
import { handleV1 } from "@/lib/v1/router";

describe("/v1 lecture média — auth", () => {
  it("401 sans Bearer", async () => {
    const res = await handleV1(new Request("https://x/v1/media", { method: "GET" }));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4 : tsc + tests + commit**
```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: API lecture /v1 — GET /v1/media (filtres+pagination) et GET /v1/media/:id"
```

## Task A3 : déployer media en preview puis prod

- [ ] **Step 1** : depuis le worktree media, `git push -u origin work/media-readapi` → suivre `gh run watch`.
- [ ] **Step 2** : valider sur la preview media (`curl -H "Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY>" https://media-work-media-readapi.lab.avqn.ch/v1/media?limit=5` → `{ items, total }`).
- [ ] **Step 3** : ouvrir la PR, squash-merge → prod `media.lab.avqn.ch`. Vérifier `GET /v1/media` en prod (avec la clé).

---

# PHASE B — `contentos` : découplage (worktree `work/contentos-media-decouple`)

Toutes les commandes Phase B depuis `contentos/`. Référence : voir la spec §7 pour la liste des suppressions.

## Task B1 : schéma — colonnes média sur `posts`, migration des données, suppression des tables

**Files:**
- Modify: `contentos/src/lib/db/schemas/posts.ts`
- Modify: `contentos/src/lib/db/schemas/publications.ts` (`mediaKind` enum → text)
- Modify: `contentos/src/lib/db/schema.ts` (retirer les exports des tables supprimées)
- Delete: `contentos/src/lib/db/schemas/{media,carousel-slides,visual-templates,visual-styles,style-guides,settings}.ts`
- Create: migration `contentos/drizzle/<nnnn>_*.sql` (hand-authored, idempotent)
- Test: néant (validé par tsc + migration sur preview)

- [ ] **Step 1 : éditer `posts.ts`**

Retirer l'import `media` et la colonne FK `mediaId`. Ajouter :
```ts
import { index, pgEnum, pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const postStatus = pgEnum('post_status', ['draft', 'validated']);

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // Référence média : objet vivant dans le service `media` (ou URL arbitraire).
  mediaId: text('media_id'),        // id côté service media, null si URL directe ou aucun média
  mediaUrl: text('media_url'),      // URL publique du média
  mediaKind: text('media_kind'),    // image | video | pdf | render
  mediaWidth: integer('media_width'),
  mediaHeight: integer('media_height'),
  content: text('content').notNull(),
  status: postStatus('status').notNull().default('draft'),
  generationJobId: text('generation_job_id').unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [index('posts_user_id_idx').on(table.userId)]);

export type Post = typeof posts.$inferSelect;
```
(`mediaId` reste mais devient un text libre sans FK ; l'index `posts_media_id_idx` est retiré.)

- [ ] **Step 2 : éditer `publications.ts`**

Remplacer l'import/usage de l'enum `mediaKind` (de `./media`) par une colonne text : `mediaKind: text('media_kind')`. Retirer l'import `./media`.

- [ ] **Step 3 : retirer les tables supprimées de `schema.ts`**

Dans `src/lib/db/schema.ts`, retirer les ré-exports de `media`, `imageAssets`, `carouselSlides`, `visualTemplates`, `visualStyles`, `styleGuides`, `settings`, et des enums `mediaKind`/`imageSource`. Supprimer les fichiers de schéma correspondants. (Les repositories de ces tables seront supprimés en Task B6 ; pour que tsc passe à cette étape, supprimer aussi leurs imports cassés au fur et à mesure — ou faire B1+B6 dans le même commit. **Recommandation : faire B1 et B6 ensemble** pour garder l'arbre compilable.)

- [ ] **Step 4 : générer puis corriger la migration (idempotente)**

```bash
cd contentos && npx drizzle-kit generate
```
Éditer le fichier SQL généré pour : (a) ajouter les colonnes `posts.media_*` en `IF NOT EXISTS`, (b) **migrer les données AVANT** tout drop, (c) dropper en `IF EXISTS`, le tout idempotent et ordonné (vérifier `drizzle/meta/_journal.json` : `when` du nouveau > précédent). Contenu cible :
```sql
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_url" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_kind" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_width" integer;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "media_height" integer;
-- Migration des références existantes (si l'ancienne table media existe encore)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media') THEN
    UPDATE "posts" p SET
      "media_url" = m."asset_key",
      "media_kind" = CASE WHEN m."kind" = 'carousel' THEN 'pdf' ELSE m."kind"::text END,
      "media_width" = m."width",
      "media_height" = m."height"
    FROM "media" m
    WHERE p."media_id" = m."id" AND p."media_url" IS NULL;
  END IF;
END $$;
-- media_id : ancienne FK → colonne text libre (drop de la contrainte si présente)
ALTER TABLE "posts" DROP CONSTRAINT IF EXISTS "posts_media_id_media_id_fk";
DROP INDEX IF EXISTS "posts_media_id_idx";
-- publications.media_kind : enum → text
ALTER TABLE "publications" ALTER COLUMN "media_kind" TYPE text USING "media_kind"::text;
-- Suppression des tables média
DROP TABLE IF EXISTS "image_assets";
DROP TABLE IF EXISTS "carousel_slides";
DROP TABLE IF EXISTS "visual_templates";
DROP TABLE IF EXISTS "visual_styles";
DROP TABLE IF EXISTS "style_guides";
DROP TABLE IF EXISTS "settings";
DROP TABLE IF EXISTS "media";
DROP TYPE IF EXISTS "media_kind";
DROP TYPE IF EXISTS "image_source";
```
Garder le snapshot drizzle-kit (il décrit le schéma final). Vérifier qu'un `drizzle-kit generate` ultérieur ne régénère rien.

- [ ] **Step 5 : tsc** (après B6 fait dans le même commit). Commit groupé avec B6.

## Task B2 : client `media-catalog` + `fetchBytes`

**Files:**
- Create: `contentos/src/lib/media-catalog/client.ts`
- Create: `contentos/src/lib/media-catalog/fetch-bytes.ts`
- Create: `contentos/src/lib/media-catalog/kind.ts` (+ test)
- Test: `contentos/test/media-catalog-kind.test.ts`

- [ ] **Step 1 : test de déduction du kind depuis une URL (échec)**

`contentos/test/media-catalog-kind.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { kindFromUrl } from "@/lib/media-catalog/kind";

describe("kindFromUrl", () => {
  it("déduit le kind de l'extension", () => {
    expect(kindFromUrl("https://x/a.png")).toBe("image");
    expect(kindFromUrl("https://x/a.jpg")).toBe("image");
    expect(kindFromUrl("https://x/a.mp4")).toBe("video");
    expect(kindFromUrl("https://x/a.pdf")).toBe("pdf");
    expect(kindFromUrl("https://x/a")).toBe("image"); // défaut
  });
});
```

- [ ] **Step 2 : lancer (échec)** — `cd contentos && npx vitest run test/media-catalog-kind.test.ts`

- [ ] **Step 3 : implémenter `kind.ts`**
```ts
export type MediaKind = "image" | "video" | "pdf" | "render";

// Déduit le kind d'un média depuis l'extension de son URL (défaut image).
export function kindFromUrl(url: string): MediaKind {
  const clean = url.split("?")[0]!.toLowerCase();
  if (/\.(mp4|mov|webm)$/.test(clean)) return "video";
  if (/\.pdf$/.test(clean)) return "pdf";
  return "image";
}
```

- [ ] **Step 4 : lancer (succès)** — PASS.

- [ ] **Step 5 : `client.ts` (lecture /v1/media)**
```ts
import { env } from "@/lib/env";
import type { MediaKind } from "./kind";

export type MediaItem = { id: string; url: string; kind: MediaKind; width: number | null; height: number | null; prompt: string | null; tags: string[]; created_at: number };
export type MediaListParams = { q?: string; kind?: MediaKind; tag?: string; orientation?: "landscape"|"portrait"|"square"; limit?: number; offset?: number };

function base(): string {
  if (!env.MEDIA_ENGINE_URL || !env.MEDIA_ENGINE_SERVICE_KEY) throw new Error("MEDIA_ENGINE_URL/KEY manquants");
  return env.MEDIA_ENGINE_URL.replace(/\/$/, "");
}
function authHeaders() { return { Authorization: `Bearer ${env.MEDIA_ENGINE_SERVICE_KEY}` }; }

export async function listMedia(params: MediaListParams): Promise<{ items: MediaItem[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.kind) qs.set("kind", params.kind);
  if (params.tag) qs.set("tag", params.tag);
  if (params.orientation) qs.set("orientation", params.orientation);
  qs.set("limit", String(params.limit ?? 30));
  qs.set("offset", String(params.offset ?? 0));
  const res = await fetch(`${base()}/v1/media?${qs}`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`media list ${res.status}`);
  return res.json();
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  const res = await fetch(`${base()}/v1/media/${encodeURIComponent(id)}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`media get ${res.status}`);
  return res.json();
}
```

- [ ] **Step 6 : `fetch-bytes.ts`**
```ts
// Récupère les octets d'un média depuis son URL publique (pour la publication).
export async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch média ${res.status} (${url})`);
  return Buffer.from(await res.arrayBuffer());
}
```

- [ ] **Step 7 : tsc + commit**
```bash
cd contentos && npx tsc --noEmit && npx vitest run test/media-catalog-kind.test.ts
git add contentos/src/lib/media-catalog contentos/test/media-catalog-kind.test.ts && git commit -m "🤖 contentos: client lecture media-catalog (/v1/media) + fetchBytes + kindFromUrl"
```

## Task B3 : attache média — cœur (résolution agnostique) + repository post

**Files:**
- Modify: `contentos/src/lib/db/repositories/posts.ts` (setPostMedia / clearPostMedia)
- Create: `contentos/src/lib/media-link/resolve.ts` (+ test)
- Test: `contentos/test/media-link-resolve.test.ts`

- [ ] **Step 1 : test de résolution (échec)**

`resolveMediaRef({ mediaId?, mediaUrl? }, getMedia)` → `{ media_id, media_url, media_kind, media_width, media_height }`. Si `mediaId`, appelle `getMedia(id)` ; sinon utilise `mediaUrl` + `kindFromUrl`. `contentos/test/media-link-resolve.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { resolveMediaRef } from "@/lib/media-link/resolve";

describe("resolveMediaRef", () => {
  it("résout par URL directe (agnostique)", async () => {
    const r = await resolveMediaRef({ mediaUrl: "https://x/a.pdf" }, async () => null);
    expect(r).toEqual({ media_id: null, media_url: "https://x/a.pdf", media_kind: "pdf", media_width: null, media_height: null });
  });
  it("résout par media_id via getMedia", async () => {
    const r = await resolveMediaRef({ mediaId: "m1" }, async () => ({ id: "m1", url: "https://x/i.png", kind: "image", width: 1200, height: 627, prompt: null, tags: [], created_at: 0 }));
    expect(r).toEqual({ media_id: "m1", media_url: "https://x/i.png", media_kind: "image", media_width: 1200, media_height: 627 });
  });
  it("erreur si ni id ni url", async () => {
    await expect(resolveMediaRef({}, async () => null)).rejects.toThrow();
  });
  it("erreur si media_id introuvable", async () => {
    await expect(resolveMediaRef({ mediaId: "x" }, async () => null)).rejects.toThrow();
  });
});
```

- [ ] **Step 2 : lancer (échec)**

- [ ] **Step 3 : implémenter `resolve.ts`**
```ts
import { kindFromUrl, type MediaKind } from "@/lib/media-catalog/kind";
import type { MediaItem } from "@/lib/media-catalog/client";

export type MediaRef = { media_id: string | null; media_url: string; media_kind: MediaKind; media_width: number | null; media_height: number | null };

// Résout une attache agnostique : par id (résolu via media) OU par URL directe.
export async function resolveMediaRef(
  input: { mediaId?: string; mediaUrl?: string },
  getMedia: (id: string) => Promise<MediaItem | null>,
): Promise<MediaRef> {
  if (input.mediaId) {
    const m = await getMedia(input.mediaId);
    if (!m) throw new Error(`Média introuvable: ${input.mediaId}`);
    return { media_id: m.id, media_url: m.url, media_kind: m.kind, media_width: m.width, media_height: m.height };
  }
  if (input.mediaUrl) {
    return { media_id: null, media_url: input.mediaUrl, media_kind: kindFromUrl(input.mediaUrl), media_width: null, media_height: null };
  }
  throw new Error("media_id ou media_url requis");
}
```

- [ ] **Step 4 : lancer (succès)**

- [ ] **Step 5 : repository post**

Dans `contentos/src/lib/db/repositories/posts.ts` : ajouter `setPostMedia(userId, postId, ref: MediaRef)` (update les colonnes `mediaId/mediaUrl/mediaKind/mediaWidth/mediaHeight` + `updatedAt`) et `clearPostMedia(userId, postId)` (les remet à null). Retirer toute logique liée à l'ancienne table media.

- [ ] **Step 6 : tsc + commit**
```bash
cd contentos && npx tsc --noEmit && npx vitest run test/media-link-resolve.test.ts
git add contentos/src/lib/media-link contentos/src/lib/db/repositories/posts.ts contentos/test/media-link-resolve.test.ts && git commit -m "🤖 contentos: résolution d'attache média agnostique (id ou URL) + repository post"
```

## Task B4 : publication LinkedIn — fetch URL + mapping kind

**Files:**
- Modify: `contentos/src/worker/queues/publish-linkedin.ts`
- Create: `contentos/src/lib/linkedin/media-kind.ts` (+ test)
- Modify: `contentos/src/lib/db/repositories/publications.ts` (snapshot lit les colonnes post)
- Test: `contentos/test/linkedin-media-kind.test.ts`

- [ ] **Step 1 : test du mapping (échec)**

`contentos/test/linkedin-media-kind.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { toLinkedInMediaKind } from "@/lib/linkedin/media-kind";

describe("toLinkedInMediaKind", () => {
  it("pdf → document, video → video, image/render → image", () => {
    expect(toLinkedInMediaKind("pdf")).toBe("document");
    expect(toLinkedInMediaKind("video")).toBe("video");
    expect(toLinkedInMediaKind("image")).toBe("image");
    expect(toLinkedInMediaKind("render")).toBe("image");
  });
});
```

- [ ] **Step 2 : lancer (échec)**

- [ ] **Step 3 : implémenter `media-kind.ts`**
```ts
// Mappe le kind média (service media) vers le type d'asset LinkedIn.
export function toLinkedInMediaKind(kind: string | null): "image" | "document" | "video" {
  if (kind === "pdf") return "document";
  if (kind === "video") return "video";
  return "image";
}
```

- [ ] **Step 4 : lancer (succès)**

- [ ] **Step 5 : brancher dans `publish-linkedin.ts`**

Remplacer `const bytes = await getMediaEngine().download(pub.snapshotKeys[0]!)` par `const bytes = await fetchBytes(pub.snapshotKeys[0]!)` (import `fetchBytes` de `@/lib/media-catalog/fetch-bytes`). Remplacer la cascade `pub.mediaKind === 'carousel'` par `toLinkedInMediaKind(pub.mediaKind)` :
```ts
const lk = toLinkedInMediaKind(pub.mediaKind);
if (lk === 'document') media = { kind: 'document', bytes, filename: 'document.pdf' };
else if (lk === 'video') media = { kind: 'video', bytes };
else media = { kind: 'image', bytes };
```
Retirer l'import `getMediaEngine`.

- [ ] **Step 6 : snapshot publication**

Là où une publication est créée (repository `publications` / la création de publication depuis un post), le `snapshotKeys` doit valoir `[post.mediaUrl]` (si présent) et `mediaKind = post.mediaKind`. Adapter le code de création de publication pour lire `post.mediaUrl`/`post.mediaKind` au lieu de l'ancienne jointure `media`.

- [ ] **Step 7 : tsc + commit**
```bash
cd contentos && npx tsc --noEmit && npx vitest run test/linkedin-media-kind.test.ts
git add contentos/ && git commit -m "🤖 contentos: publication LinkedIn via fetch URL + mapping kind (pdf→document)"
```

## Task B5 : worker & queues — retirer generate-image / render-visual

**Files:**
- Modify: `contentos/src/worker/index.ts`
- Modify: `contentos/src/lib/queue/client.ts`
- Modify: `contentos/src/lib/queue/enqueue.ts`
- Delete: `contentos/src/worker/queues/{generate-image,render-visual}.ts`

- [ ] **Step 1** : `worker/index.ts` — retirer les `new Worker('render-visual', …)` et `new Worker('generate-image', …)`, leurs imports (`makeProcessGenerateImage`, `makeProcessRenderVisual`), et `closeRenderer` (de visual-templates/render, supprimé). Garder `dummy` + `publish-linkedin`.
- [ ] **Step 2** : `queue/client.ts` — supprimer `renderVisualQueue`, `generateImageQueue` et leurs types (`RenderVisualJob/Result`, `GenerateImageJob/Result`). Garder `dummyQueue`, `publishLinkedinQueue`.
- [ ] **Step 3** : `queue/enqueue.ts` — supprimer `enqueueRenderVisual`, `enqueueGenerateImage`. Garder l'enqueue de publication.
- [ ] **Step 4** : supprimer les fichiers queue de rendu/génération.
- [ ] **Step 5 : tsc + commit** (avec B6 si imports croisés). 
```bash
cd contentos && npx tsc --noEmit
```

## Task B6 : suppression du code de création média

**Files (Delete) :**
- `contentos/src/lib/media-engine/` (tout)
- `contentos/src/lib/visual-templates/` (tout)
- `contentos/src/lib/carousel/` (tout)
- `contentos/src/lib/ai/generate-image.ts`
- `contentos/src/lib/media/` (upload-core, upload-video-core, validate-upload, …)
- `contentos/src/lib/db/repositories/{visual-templates,visual-styles,style-guides,settings,media}.ts` (et image-assets/carousel-slides s'ils existent)
- `contentos/src/app/api/media-stub/` (route stub)

- [ ] **Step 1** : supprimer les dossiers/fichiers ci-dessus.
- [ ] **Step 2** : corriger toutes les références cassées (grep) : `getMediaEngine`, `@/lib/media-engine`, `@/lib/visual-templates`, `@/lib/carousel`, `@/lib/ai/generate-image`, `@/lib/media/upload`, repositories supprimés. Retirer les usages.
- [ ] **Step 3 : env** — `src/lib/env.ts` : retirer `CONTENT_OS_MEDIA_STUB`, `MEDIA_STUB_DIR`. Garder `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY` (utilisés par media-catalog). Retirer les usages des vars supprimées.
- [ ] **Step 4 : tests** — supprimer les tests des modules supprimés (`test/**` touchant media-engine, visual-templates, carousel, upload, visuals/style-guides MCP, render-visual/generate-image queues).
- [ ] **Step 5 : tsc + tests + commit** (commit groupé B1+B5+B6 pour garder l'arbre compilable)
```bash
cd contentos && npx tsc --noEmit && npx vitest run
npx drizzle-kit generate  # doit dire "No changes" (schéma = snapshot)
git add contentos/ && git commit -m "🤖 contentos: suppression de la création média (engine, templates, styles, chartes, PDF, upload, queues, tables)"
```

## Task B7 : MCP — réduire aux outils d'attache

**Files:**
- Modify: `contentos/src/lib/mcp/tools/media.ts` (ne garder que attach/detach, agnostique)
- Modify: `contentos/src/lib/mcp/server.ts` (retirer registerVisualTools, registerStyleGuideTools)
- Delete: `contentos/src/lib/mcp/tools/{visuals,style-guides}.ts`
- Modify: `contentos/test/` (tests MCP comptant les outils)

- [ ] **Step 1** : réécrire `tools/media.ts` → `registerMediaTools(server)` avec **uniquement** :
  - `attach_media_to_post` { `post_id`: string, `media_id?`: string, `media_url?`: string } → `resolveMediaRef({mediaId,mediaUrl}, getMedia)` puis `setPostMedia(userId, post_id, ref)` → `jsonResult(post)`. Description FR : attache un média du service `media` (par id) ou n'importe quelle URL.
  - `detach_media` { `post_id` } → `clearPostMedia` → `jsonResult({ detached: true })`.
  Retirer `enqueueGenerateImage`/`enqueueRenderVisual`, `generate_image`, `edit_image`, `render_visual`, `list_gallery_images`.
- [ ] **Step 2** : `mcp/server.ts` — retirer les imports/appels `registerVisualTools`, `registerStyleGuideTools`. Garder `registerMediaTools` (réduit), ideas/posts/config/publishing/voices.
- [ ] **Step 3** : supprimer `tools/visuals.ts`, `tools/style-guides.ts`.
- [ ] **Step 4** : mettre à jour les tests MCP qui énumèrent les outils (comptage/liste).
- [ ] **Step 5 : tsc + tests + commit**
```bash
cd contentos && npx tsc --noEmit && npx vitest run
git add contentos/ && git commit -m "🤖 contentos: MCP réduit — attach_media_to_post (agnostique) + detach_media, retrait des outils de création"
```

## Task B8 : UI — picker média + retrait des pages de création

**Files:**
- Create: `contentos/src/app/(app)/posts/[id]/_components/media-picker.tsx` (client, modal)
- Create: `contentos/src/app/(app)/posts/[id]/media-picker-actions.ts` (server actions : list + attach + detach)
- Modify: `contentos/src/app/(app)/posts/[id]/_components/post-editor.tsx` (remplacer add-visual-dialog par le picker)
- Modify: `contentos/src/app/(app)/posts/[id]/media-actions.ts` / `media-actions-core.ts` (attache par ref, plus de génération)
- Delete: `contentos/src/app/(app)/posts/[id]/_components/{add-visual-dialog,variables-form}.tsx`, `contentos/src/app/(app)/media/` (galerie de génération + edit-image), pages templates/styles/chartes.

Validation **manuelle sur preview** (pas de test unitaire UI). `npm run build` doit passer.

- [ ] **Step 1** : server actions `media-picker-actions.ts` (`"use server"`) :
  - `searchMediaAction(params)` → `listMedia(params)` (client media-catalog) → renvoie items.
  - `attachAction(postId, mediaId)` → `resolveMediaRef({mediaId}, getMedia)` + `setPostMedia` + `revalidatePath`.
  - `detachAction(postId)` → `clearPostMedia` + `revalidatePath`.
- [ ] **Step 2** : `media-picker.tsx` (client) — modal : champ recherche, filtres (type, orientation, tag), grille de vignettes paginée (du plus récent au plus ancien via le tri serveur), bouton « Charger plus » (offset). Sélection → `attachAction`. Sobre.
- [ ] **Step 3** : `post-editor.tsx` — remplacer le dialog « add visual » par « Choisir un média » (ouvre le picker) + aperçu du média attaché (img/video/lien pdf) + « Détacher ». Retirer toute UI de génération/template/variables.
- [ ] **Step 4** : supprimer les pages/dossiers UI de création (galerie `media/`, templates, styles, chartes, add-visual-dialog, variables-form).
- [ ] **Step 5 : build + commit**
```bash
cd contentos && npx tsc --noEmit && npm run build
git add contentos/ && git commit -m "🤖 contentos: picker média (lecture media) dans l'éditeur de post + retrait des UIs de création"
```

## Task B9 : repointage, doc, déploiement preview, validation

**Files:**
- Modify: `contentos/CLAUDE.md` (interfaces & données — état cible)

- [ ] **Step 1 : secret** — repointer `MEDIA_ENGINE_URL` (scope `contentos`, via `/lab-secret`) vers `https://media.lab.avqn.ch` et aligner `MEDIA_ENGINE_SERVICE_KEY` sur celui de `media`. (Action opérateur ; hors build.)
- [ ] **Step 2 : doc** — `contentos/CLAUDE.md` : réécrire les sections média (instantané) : ContentOS consomme `media` (picker + attach), plus de génération/templates/upload ; outils MCP `attach_media_to_post`/`detach_media` ; worker = `publish-linkedin` + `dummy`.
- [ ] **Step 3 : vérif finale** — `cd contentos && npx tsc --noEmit && npx vitest run && npm run build` (vert).
- [ ] **Step 4 : push + preview** — `git push -u origin work/contentos-media-decouple` ; `gh run watch`. Preview `https://contentos-work-contentos-media-decouple.lab.avqn.ch`.
- [ ] **Step 5 : validation runtime** (login, sur preview pointant media prod) : picker liste les médias de media, attache à un post, aperçu OK ; détache ; (publication LinkedIn en stub si pas de compte) ; MCP `attach_media_to_post` par id et par URL. Vérifier qu'aucun outil/écran de création média ne subsiste.
- [ ] **Step 6 : PR** — ouvrir la PR contentos (ne pas merger sans le feu vert de Manu).

---

## Self-review (couverture spec)

- §4 colonnes post + drop tables + migration données → B1. ✓
- §5 media API lecture → A1 (repo) + A2 (routes) + A3 (deploy). ✓
- §6 MCP attach/detach agnostique → B3 (résolution) + B7 (outils) ; picker UI → B8 ; publication fetch URL + mapping → B4. ✓
- §7 suppressions (engine, templates, carousel, ai, upload, queues, repos, pages, settings/brand) → B5 + B6 + B8. ✓
- §8 repointage + séquencement → A3 (media prod d'abord) + B9 step 1. ✓
- §9 tests → A1/A2, B2/B3/B4 (logique pure) ; runtime preview → B9. ✓
- §10 risques (URLs héritées null media_id ; recherche prompt+tags) → gérés en B1/B2.
- Idempotence migration + ordre journal → B1 step 4 (base preview persistante). ✓
