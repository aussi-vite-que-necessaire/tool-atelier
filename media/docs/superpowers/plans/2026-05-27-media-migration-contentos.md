# media — centre des médias (migration ContentOS) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de `media` le centre unique des médias : templates visuels Handlebars, catalogue de styles de génération, chartes graphiques, construction de PDF, upload image/PDF/vidéo — exposés par MCP + `/v1` + petites UIs d'admin, jusqu'au déploiement preview.

**Architecture:** Lift-and-port adapté depuis ContentOS. `media` reste une app Next.js synchrone (pas de worker). On généralise la table `images` en `media` (`kind`), on ajoute 4 tables (`visual_styles`, `style_guides`, `visual_templates`, `brand`), on porte les modules purs (DSL/compile/brand, pdf-lib), et on branche tout sur le `store()` interne existant. Le contrat `/v1` existant n'est jamais cassé (ajouts uniquement).

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (postgres-js), BetterAuth, `@modelcontextprotocol/sdk` + `mcp-handler`, zod, Handlebars, pdf-lib, Tailwind 4, vitest.

**Source de référence pour le portage :** `/Users/ManuAVQN/Code/atelier/contentos` (lecture seule, ne rien y modifier).

**Spec :** `docs/superpowers/specs/2026-05-27-media-migration-contentos-design.md`.

**Conventions de travail :**
- Branche `work/media-migration-contentos` (worktree courant). Jamais de commit sur `main`.
- 2 espaces, fonctions déclarées, commentaires français (cf. CLAUDE.md global).
- TDD pour la **logique pure** (vitest, sans DB ni réseau). Les repositories/outils MCP/routes `/v1`/UI sont validés sur la **preview déployée** (runtime réel : Postgres, browserless, Gemini, R2).
- `npx tsc --noEmit` doit passer avant chaque commit (typage). `npm test` (vitest) doit passer.

**Types partagés (référence, définis en Task 1) :**

```ts
// src/lib/media/types.ts
export type MediaKind = "image" | "video" | "pdf" | "render";
export type MediaSource =
  | "gemini_generate" | "gemini_edit" | "html_render"
  | "template_render" | "upload" | "pdf_aggregate";

export interface MediaRecord {
  id: string;
  r2_key: string;
  url: string;
  kind: MediaKind;
  mime: string;
  prompt: string | null;
  parent_id: string | null;
  source: MediaSource;
  template_id: string | null;
  vars: Record<string, unknown> | null;
  style_id: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: number; // unix ms
}
```

---

## Task 1 : Généraliser le store objet (table `images` → `media`) + schéma complet

But : poser tout le schéma (table `media` généralisée + `visual_styles`, `style_guides`, `visual_templates`, `brand`) en **une seule migration**, et renommer le module `images` → `media` en gardant les 6 outils et le `/v1` fonctionnels. Aucune autre task n'ajoutera de migration.

**Files:**
- Modify: `media/package.json` (deps `handlebars`, `pdf-lib`)
- Modify: `media/src/db/schema.ts` (renommer table + colonnes + 4 nouvelles tables)
- Create: `media/src/lib/media/types.ts` (depuis `src/lib/images/types.ts`, généralisé)
- Create: `media/src/lib/media/repository.ts` (depuis `src/lib/images/repository.ts`, généralisé)
- Modify: `media/src/lib/store.ts` (ajoute `kind`, `mime`, `size_bytes`, `template_id`, `vars`, `style_id`)
- Create: `media/src/lib/media/kind.ts` (`kindForMime`)
- Modify: `media/src/lib/mcp/server.ts` + `media/src/lib/v1/router.ts` (imports `@/lib/media/*`)
- Delete: `media/src/lib/images/types.ts`, `media/src/lib/images/repository.ts`
- Create: migration `media/drizzle/0003_*.sql` (rename + add cols + create tables)
- Test: `media/test/kind.test.ts`

- [ ] **Step 1 : Ajouter les dépendances**

```bash
cd media && npm install handlebars@^4.7.9 pdf-lib@^1.17.1
```

- [ ] **Step 2 : Écrire le test de `kindForMime` (échec attendu)**

`media/test/kind.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { kindForMime } from "@/lib/media/kind";

describe("kindForMime", () => {
  it("classe les images", () => {
    expect(kindForMime("image/png")).toBe("image");
    expect(kindForMime("image/jpeg")).toBe("image");
    expect(kindForMime("image/webp")).toBe("image");
  });
  it("classe les vidéos", () => {
    expect(kindForMime("video/mp4")).toBe("video");
  });
  it("classe les PDF", () => {
    expect(kindForMime("application/pdf")).toBe("pdf");
  });
  it("retombe sur image pour l'inconnu", () => {
    expect(kindForMime("application/octet-stream")).toBe("image");
  });
});
```

- [ ] **Step 3 : Lancer le test (échec)**

Run: `cd media && npx vitest run test/kind.test.ts`
Expected: FAIL (`kindForMime` introuvable).

- [ ] **Step 4 : Implémenter `kind.ts` + `types.ts`**

`media/src/lib/media/types.ts` : le bloc « Types partagés » ci-dessus (copier intégralement).

`media/src/lib/media/kind.ts` :

```ts
import type { MediaKind } from "./types";

// Déduit le type de média à partir du MIME (uploads). Inconnu → image (cas le plus courant).
export function kindForMime(mime: string): MediaKind {
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "image";
}
```

- [ ] **Step 5 : Lancer le test (succès)**

Run: `cd media && npx vitest run test/kind.test.ts`
Expected: PASS.

- [ ] **Step 6 : Mettre à jour le schéma Drizzle**

Dans `media/src/db/schema.ts`, remplacer le bloc `images` par la table `media` et ajouter les 4 tables. Conserver les noms de colonnes existants, ajouter les nouvelles :

```ts
export const media = pgTable(
  "media",
  {
    id: text("id").primaryKey(),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    kind: text("kind").notNull().default("image"),
    mime: text("mime").notNull().default("image/png"),
    prompt: text("prompt"),
    parentId: text("parent_id"),
    source: text("source").notNull(),
    templateId: text("template_id"),
    vars: jsonb("vars").$type<Record<string, unknown>>(),
    styleId: text("style_id"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("idx_media_created").on(t.createdAt),
    index("idx_media_parent").on(t.parentId),
    index("idx_media_source").on(t.source),
    index("idx_media_kind").on(t.kind),
  ],
);

export const visualStyles = pgTable("visual_styles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const styleGuides = pgTable("style_guides", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const visualTemplates = pgTable(
  "visual_templates",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    platform: text("platform").notNull().default("linkedin"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bodyHtml: text("body_html").notNull(),
    css: text("css").notNull().default(""),
    variablesSchema: jsonb("variables_schema").$type<unknown[]>().notNull().default([]),
    sampleVars: jsonb("sample_vars").$type<Record<string, unknown>>().notNull().default({}),
    styleGuideId: text("style_guide_id").references(() => styleGuides.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

export const brand = pgTable("brand", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  signature: text("signature").notNull().default(""),
  logoUrl: text("logo_url"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Mettre à jour l'export `schema` : remplacer `images` par `media`, ajouter `visualStyles`, `styleGuides`, `visualTemplates`, `brand`.

- [ ] **Step 7 : Générer puis corriger la migration (RENAME, pas DROP/CREATE)**

```bash
cd media && npx drizzle-kit generate
```

drizzle-kit peut traiter `images`→`media` comme drop+create (interactif/non résolu). **Éditer le fichier `drizzle/0003_*.sql` généré** pour que la partie `images`/`media` soit un renommage préservant les lignes, et garder les `CREATE TABLE` des tables réellement nouvelles. Contenu cible du fichier :

```sql
ALTER TABLE "images" RENAME TO "media";
ALTER TABLE "media" ADD COLUMN "kind" text DEFAULT 'image' NOT NULL;
ALTER TABLE "media" ADD COLUMN "mime" text DEFAULT 'image/png' NOT NULL;
ALTER TABLE "media" ADD COLUMN "template_id" text;
ALTER TABLE "media" ADD COLUMN "vars" jsonb;
ALTER TABLE "media" ADD COLUMN "style_id" text;
ALTER TABLE "media" ADD COLUMN "size_bytes" integer;
UPDATE "media" SET "kind" = CASE WHEN "source" = 'html_render' THEN 'render' ELSE 'image' END;
DROP INDEX IF EXISTS "idx_images_created";
DROP INDEX IF EXISTS "idx_images_parent";
DROP INDEX IF EXISTS "idx_images_source";
CREATE INDEX "idx_media_created" ON "media" ("created_at");
CREATE INDEX "idx_media_parent" ON "media" ("parent_id");
CREATE INDEX "idx_media_source" ON "media" ("source");
CREATE INDEX "idx_media_kind" ON "media" ("kind");

CREATE TABLE "visual_styles" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "prompt" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "style_guides" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "visual_templates" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "platform" text DEFAULT 'linkedin' NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "body_html" text NOT NULL,
  "css" text DEFAULT '' NOT NULL,
  "variables_schema" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sample_vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "style_guide_id" text REFERENCES "style_guides"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "brand" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "signature" text DEFAULT '' NOT NULL,
  "logo_url" text,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

Conserver le snapshot `drizzle/meta/*` généré par drizzle-kit (il décrit déjà la table `media` : les futurs diffs resteront corrects). Vérifier que le `_journal.json` référence bien `0003`.

- [ ] **Step 8 : Généraliser `types.ts`, `repository.ts`, `store.ts`**

Créer `media/src/lib/media/repository.ts` à partir de `src/lib/images/repository.ts` : importer `media` au lieu de `images`, ajouter les colonnes dans `toRecord`/`insertImage` (renommer `insertImage`→`insertMedia`, `getImageRecord`→`getMediaRecord`, `deleteImageRow`→`deleteMediaRow`, `listImageRecords`→`listMediaRecords`). `toRecord` mappe `kind`, `mime`, `templateId→template_id`, `vars`, `styleId→style_id`, `sizeBytes→size_bytes`. `ListParams` gagne `kind?: MediaKind` (filtre `eq(media.kind, ...)`).

Mettre à jour `media/src/lib/store.ts` :

```ts
import { newId } from "./ids";
import { extensionForMime, parseImageDimensions } from "./image-meta";
import { objectKey, publicUrl, putImage, deleteObject } from "./storage";
import { insertMedia } from "./media/repository";
import type { MediaRecord, MediaKind, MediaSource } from "./media/types";

export interface StoreInput {
  bytes: Uint8Array;
  mimeType: string;
  kind: MediaKind;
  prompt: string | null;
  parent_id: string | null;
  source: MediaSource;
  tags: string[];
  width?: number;
  height?: number;
  template_id?: string | null;
  vars?: Record<string, unknown> | null;
  style_id?: string | null;
}

export async function store(input: StoreInput): Promise<MediaRecord> {
  const id = newId();
  const ext = extensionForMime(input.mimeType);
  const key = objectKey(id, ext);
  await putImage(key, input.bytes, input.mimeType);

  const dims =
    input.width && input.height
      ? { width: input.width, height: input.height }
      : (input.kind === "image" || input.kind === "render"
          ? parseImageDimensions(input.bytes)
          : null) ?? { width: null, height: null };

  const record: MediaRecord = {
    id,
    r2_key: key,
    url: publicUrl(key),
    kind: input.kind,
    mime: input.mimeType,
    prompt: input.prompt,
    parent_id: input.parent_id,
    source: input.source,
    template_id: input.template_id ?? null,
    vars: input.vars ?? null,
    style_id: input.style_id ?? null,
    tags: input.tags,
    width: dims.width,
    height: dims.height,
    size_bytes: input.bytes.byteLength,
    created_at: Date.now(),
  };

  try {
    await insertMedia(record);
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
  return record;
}
```

`insertMedia` insère toutes les nouvelles colonnes.

- [ ] **Step 9 : Recâbler les appelants (mcp/server.ts, v1/router.ts)**

Remplacer les imports `@/lib/images/repository` → `@/lib/media/repository` et les noms (`getImageRecord`→`getMediaRecord`, etc.). Ajouter `kind` aux appels `store()` existants : `gemini_generate`/`gemini_edit` → `kind: "image"` ; `html_render` → `kind: "render"`. Dans `mcp/server.ts`, `list_images` accepte un filtre `source` inchangé (l'enum d'entrée reste celle d'origine pour ne pas casser le connecteur ; les nouvelles sources seront filtrables via `list_media` en Task plus tard si besoin). Supprimer `src/lib/images/`.

- [ ] **Step 10 : Typage + tests + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
```
Expected: tsc OK, tous les tests verts (les tests existants `v1-router`, `mcp-server` doivent toujours passer).

```bash
git add media/ && git commit -m "🤖 media: généralise le store en table media (kind) + schéma templates/styles/guides/brand"
```

---

## Task 2 : Visual styles — repository, outils MCP, intégration à la génération

**Files:**
- Create: `media/src/lib/styles/repository.ts`
- Create: `media/src/lib/styles/compose.ts` (+ test)
- Create: `media/src/lib/mcp/tools/styles.ts`
- Modify: `media/src/lib/mcp/server.ts` (enregistrer les outils styles + `style_id` sur `generate_image`)
- Modify: `media/src/lib/v1/router.ts` (`styleId` optionnel sur `/v1/generate`)
- Test: `media/test/style-compose.test.ts`

- [ ] **Step 1 : Test de composition de prompt (échec)**

`media/test/style-compose.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { composePrompt } from "@/lib/styles/compose";

describe("composePrompt", () => {
  it("renvoie le prompt seul sans style", () => {
    expect(composePrompt("un chat", null)).toBe("un chat");
  });
  it("concatène le style", () => {
    expect(composePrompt("un chat", "style 3D doux")).toBe("un chat\n\nStyle: style 3D doux");
  });
  it("ignore un style vide", () => {
    expect(composePrompt("un chat", "")).toBe("un chat");
  });
});
```

- [ ] **Step 2 : Lancer (échec)** — `cd media && npx vitest run test/style-compose.test.ts` → FAIL.

- [ ] **Step 3 : Implémenter `compose.ts`**

```ts
// Compose le prompt de génération avec le suffixe de style (même format que le /v1 existant).
export function composePrompt(prompt: string, stylePrompt: string | null | undefined): string {
  const s = (stylePrompt ?? "").trim();
  return s ? `${prompt}\n\nStyle: ${s}` : prompt;
}
```

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Repository styles**

`media/src/lib/styles/repository.ts` : porter le modèle de `contentos/src/lib/db/repositories/visual-styles.ts` **sans `userId`** (mono-utilisateur). Fonctions : `createStyle({name,prompt})`, `getStyle(id)`, `listStyles()`, `updateStyle(id, patch)`, `deleteStyle(id)`. Ids via `newId()` (`@/lib/ids`). Table `visualStyles` de `@/db/schema`.

- [ ] **Step 6 : Outils MCP styles**

`media/src/lib/mcp/tools/styles.ts` : exporter `registerStyleTools(server)`. S'inspirer de `contentos/src/lib/mcp/tools/visuals.ts` (parties styles, lignes 151-182). Outils : `list_visual_styles`, `create_visual_style` (`name`, `prompt`), `update_visual_style` (`style_id`, `name?`, `prompt?`), `delete_visual_style` (`style_id`). Résultats via `jsonResult` (`@/lib/mcp/result`).

- [ ] **Step 7 : Câbler `style_id` dans `generate_image` + `/v1/generate`**

Dans `mcp/server.ts` `generate_image` : ajouter input `style_id: z.string().optional()`. Avant génération : si `style_id`, `const st = await getStyle(style_id)` puis `composePrompt(prompt, st?.prompt)`. Stocker `style_id` dans `store()`. Enregistrer `registerStyleTools(server)` dans `registerAllTools`.

Dans `v1/router.ts` `GenerateSchema` : ajouter `styleId: z.string().optional()`. Dans `handleGenerate` : résoudre `styleId`→prompt (priorité au `stylePrompt` explicite s'il est fourni, sinon style résolu), via `composePrompt`. Conserver le passthrough `stylePrompt` existant.

- [ ] **Step 8 : Typage + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: catalogue de styles visuels (MCP CRUD) + style_id sur la génération"
```

---

## Task 3 : Style guides — repository, outils MCP

**Files:**
- Create: `media/src/lib/style-guides/repository.ts`
- Create: `media/src/lib/mcp/tools/style-guides.ts`
- Modify: `media/src/lib/mcp/server.ts` (enregistrer)

- [ ] **Step 1 : Repository**

`media/src/lib/style-guides/repository.ts` : porter `contentos/src/lib/db/repositories/style-guides.ts` **sans `userId`**. `createGuide({name,content})`, `getGuide(id)`, `listGuides()`, `updateGuide(id, patch)`, `deleteGuide(id)`. Table `styleGuides`, ids `newId()`.

- [ ] **Step 2 : Outils MCP**

`media/src/lib/mcp/tools/style-guides.ts` : `registerStyleGuideTools(server)`. S'inspirer de `contentos/src/lib/mcp/tools/style-guides.ts`. Outils : `list_style_guides`, `get_style_guide` (`guide_id`), `create_style_guide` (`name`, `content`), `update_style_guide` (`guide_id`, `name?`, `content?`), `delete_style_guide` (`guide_id`). `get_style_guide` renvoie aussi la liste des templates liés (`listTemplates({ styleGuideId })` — disponible après Task 5 ; jusque-là, renvoyer seulement la fiche). `jsonResult`.

- [ ] **Step 3 : Enregistrer + typage + commit**

Ajouter `registerStyleGuideTools(server)` dans `registerAllTools`.

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: chartes graphiques (style guides) — MCP CRUD"
```

---

## Task 4 : Brand — repository ligne unique, contexte de marque, outils MCP

**Files:**
- Create: `media/src/lib/brand/repository.ts`
- Create: `media/src/lib/brand/context.ts` (+ test)
- Create: `media/src/lib/mcp/tools/brand.ts`
- Modify: `media/src/lib/mcp/server.ts`
- Test: `media/test/brand-context.test.ts`

- [ ] **Step 1 : Test du contexte de marque (échec)**

`media/test/brand-context.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { toBrandContext, EMPTY_BRAND } from "@/lib/brand/context";

describe("toBrandContext", () => {
  it("brand vide → tout vide, signature null", () => {
    expect(toBrandContext(null)).toEqual(EMPTY_BRAND);
  });
  it("mappe les champs ; signature vide → null", () => {
    expect(
      toBrandContext({ id: "brand", name: "AVQN", signature: "", logoUrl: null, updatedAt: new Date() }),
    ).toEqual({ name: "AVQN", signature: null, logo: "" });
  });
  it("garde une signature non vide et le logo", () => {
    expect(
      toBrandContext({ id: "brand", name: "AVQN", signature: "— Manu", logoUrl: "https://x/l.png", updatedAt: new Date() }),
    ).toEqual({ name: "AVQN", signature: "— Manu", logo: "https://x/l.png" });
  });
});
```

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : Implémenter `context.ts`**

```ts
import type { brand } from "@/db/schema";

type BrandRow = typeof brand.$inferSelect;

// Contexte injecté dans tout template sous le handle `brand` (cf. templates/compile).
export type Brand = { name: string; signature: string | null; logo: string };
export const EMPTY_BRAND: Brand = { name: "", signature: null, logo: "" };

export function toBrandContext(row: BrandRow | null): Brand {
  if (!row) return EMPTY_BRAND;
  return {
    name: row.name,
    signature: row.signature.length > 0 ? row.signature : null,
    logo: row.logoUrl ?? "",
  };
}
```

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Repository ligne unique**

`media/src/lib/brand/repository.ts` : `id` fixe `"brand"`. `getBrand()` → la ligne ou `null`. `upsertBrand({name,signature,logoUrl})` → insert avec `id:"brand"` ou update `onConflictDoUpdate`, `updatedAt: new Date()`. Helper `getBrandContext()` = `toBrandContext(await getBrand())`.

- [ ] **Step 6 : Outils MCP brand**

`media/src/lib/mcp/tools/brand.ts` : `registerBrandTools(server)`. `get_brand` (aucun arg → ligne ou défauts), `update_brand` (`name?`, `signature?`, `logo_url?`). `jsonResult`.

- [ ] **Step 7 : Enregistrer + typage + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: réglages de marque (brand) — contexte + MCP get/update"
```

---

## Task 5 : Templates visuels — DSL, compile, repository, render, MCP + /v1

**Files:**
- Create: `media/src/lib/templates/dsl.ts` (port + test)
- Create: `media/src/lib/templates/base.css` (copie)
- Create: `media/src/lib/templates/compile.ts` (port adapté + test)
- Create: `media/src/lib/templates/repository.ts`
- Create: `media/src/lib/templates/render.ts`
- Create: `media/src/lib/mcp/tools/templates.ts`
- Modify: `media/src/lib/mcp/server.ts`
- Modify: `media/src/lib/v1/router.ts` (`POST /v1/render-template`)
- Test: `media/test/templates-dsl.test.ts`, `media/test/templates-compile.test.ts`

- [ ] **Step 1 : Porter le DSL + son test**

Copier `contentos/src/lib/visual-templates/dsl.ts` → `media/src/lib/templates/dsl.ts` **tel quel** (aucune dépendance hors `zod`).

`media/test/templates-dsl.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { parseVariablesSchema, fillVarDefaults, variablesSchemaToZod } from "@/lib/templates/dsl";

const schema = parseVariablesSchema([
  { name: "titre", label: "Titre", type: "string", max: 80 },
  { name: "points", label: "Points", type: "list" },
  { name: "accent", label: "Accent", type: "color", default: "#ff0000" },
  { name: "photo", label: "Photo", type: "image" },
]);

describe("dsl", () => {
  it("rejette un nom dupliqué", () => {
    expect(() => parseVariablesSchema([
      { name: "x", label: "X", type: "string", max: 10 },
      { name: "x", label: "X2", type: "string", max: 10 },
    ])).toThrow();
  });
  it("remplit les défauts typés", () => {
    const filled = fillVarDefaults(schema, { titre: "Salut" });
    expect(filled).toEqual({ titre: "Salut", points: [], accent: "#ff0000", photo: "" });
  });
  it("valide via zod (image optionnelle en preview)", () => {
    const zod = variablesSchemaToZod(schema, { imagesOptional: true });
    expect(zod.safeParse({ titre: "ok" }).success).toBe(true);
  });
});
```

Run: `cd media && npx vitest run test/templates-dsl.test.ts` → PASS (le port est fonctionnel d'emblée).

- [ ] **Step 2 : Copier `base.css`**

Copier `contentos/src/lib/visual-templates/base.css` → `media/src/lib/templates/base.css` tel quel.

- [ ] **Step 3 : Porter `compile.ts` (adapter les types) + test**

Copier `contentos/src/lib/visual-templates/compile.ts` → `media/src/lib/templates/compile.ts`. Adapter :
- `import type { VisualTemplate } from "@/lib/db/schema"` → `import type { visualTemplates } from "@/db/schema"; type VisualTemplate = typeof visualTemplates.$inferSelect;`
- `import type { Brand } from "./brand"` → `import type { Brand } from "@/lib/brand/context"`
- Le reste (helpers, cache LRU, `compileTemplate`) inchangé. `input.template.bodyHtml`/`.css`/`.width`/`.height` correspondent aux colonnes Drizzle (camelCase).

`media/test/templates-compile.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { compileTemplate } from "@/lib/templates/compile";
import { EMPTY_BRAND } from "@/lib/brand/context";

function tpl(over: Partial<{ bodyHtml: string; css: string; width: number; height: number }> = {}) {
  return {
    id: "t1", slug: "s", label: "L", platform: "linkedin",
    width: 1200, height: 627, bodyHtml: "<h1>{{escape titre}}</h1>", css: "h1{color:{{accent}}}",
    variablesSchema: [], sampleVars: {}, styleGuideId: null,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  } as Parameters<typeof compileTemplate>[0]["template"];
}

describe("compileTemplate", () => {
  it("injecte les variables et la marque", () => {
    const html = compileTemplate({
      template: tpl(),
      vars: { titre: "Bonjour", accent: "#123456" },
      brand: EMPTY_BRAND,
    });
    expect(html).toContain("<h1>Bonjour</h1>");
    expect(html).toContain("color:#123456");
    expect(html).toContain('style="width:1200px;height:627px"');
  });
  it("expose brand dans le contexte", () => {
    const html = compileTemplate({
      template: tpl({ bodyHtml: "<p>{{brand.name}}</p>" }),
      vars: {},
      brand: { name: "AVQN", signature: null, logo: "" },
    });
    expect(html).toContain("<p>AVQN</p>");
  });
});
```

Run: `cd media && npx vitest run test/templates-compile.test.ts` → PASS.

- [ ] **Step 4 : Repository templates**

`media/src/lib/templates/repository.ts` : `createTemplate(data)`, `getTemplate(id)`, `getTemplateBySlug(slug)`, `listTemplates(opts?: { styleGuideId?: string })`, `updateTemplate(id, patch)`, `deleteTemplate(id)`. Sans `userId`. Valider `variablesSchema` via `parseVariablesSchema` à la création/màj. Table `visualTemplates`, ids `newId()`.

- [ ] **Step 5 : Module render**

`media/src/lib/templates/render.ts` :

```ts
import { getTemplate } from "./repository";
import { compileTemplate } from "./compile";
import { fillVarDefaults, parseVariablesSchema, variablesSchemaToZod } from "./dsl";
import { getBrandContext } from "@/lib/brand/repository";
import { renderHtml } from "@/lib/render";
import { store } from "@/lib/store";
import type { MediaRecord } from "@/lib/media/types";

// Compile un template + variables + marque → HTML → image (via browserless) → store.
export async function renderTemplate(
  templateId: string,
  vars: Record<string, unknown>,
  opts: { imagesOptional?: boolean } = {},
): Promise<MediaRecord> {
  const template = await getTemplate(templateId);
  if (!template) throw new Error(`Template introuvable: ${templateId}`);

  const schema = parseVariablesSchema(template.variablesSchema);
  const validated = variablesSchemaToZod(schema, opts).parse(vars);
  const filled = fillVarDefaults(schema, validated);
  const brand = await getBrandContext();

  const html = compileTemplate({ template, vars: filled, brand });
  const { bytes, mimeType } = await renderHtml({ html, width: template.width, height: template.height });
  return store({
    bytes, mimeType, kind: "render", prompt: null, parent_id: null,
    source: "template_render", tags: [], width: template.width, height: template.height,
    template_id: template.id, vars: filled,
  });
}
```

- [ ] **Step 6 : Outils MCP templates**

`media/src/lib/mcp/tools/templates.ts` : `registerTemplateTools(server)`. S'inspirer de `contentos/src/lib/mcp/tools/visuals.ts` (parties templates, lignes 85-150). Outils :
- `list_visual_templates`, `get_visual_template` (`template_id`)
- `create_visual_template` (`slug`, `label`, `width`, `height`, `body_html`, `css?`, `variables_schema?`, `sample_vars?`, `style_guide_id?`)
- `update_visual_template` (`template_id` + champs optionnels)
- `delete_visual_template` (`template_id`)
- `render_template` (`template_id`, `vars` (objet)) → `renderTemplate(...)`, renvoie `imageResult(bytes, mimeType, {id,url,width,height})`. Comme `renderTemplate` ne renvoie pas les octets, recharger via `getImageBytes(rec.r2_key)` pour le content block image, OU faire renvoyer les octets par `renderTemplate`. **Choix** : `render_template` renvoie `jsonResult({id,url,width,height})` (pas d'octets embarqués) pour rester simple ; l'URL suffit.

- [ ] **Step 7 : `/v1/render-template`**

Dans `v1/router.ts` : ajouter `RenderTemplateSchema = z.object({ templateId: z.string().min(1), vars: z.record(z.string(), z.unknown()).default({}) })`, un `handleRenderTemplate` qui appelle `renderTemplate(templateId, vars)` et renvoie `{ id, url, width, height }`, et la route `POST /v1/render-template`.

- [ ] **Step 8 : Enregistrer + typage + tests + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: templates visuels (DSL Handlebars + compile + render) — MCP + /v1/render-template"
```

---

## Task 6 : PDF — construction depuis des images

**Files:**
- Create: `media/src/lib/pdf/build.ts` (port + test)
- Create: `media/src/lib/pdf/aggregate.ts`
- Create: `media/src/lib/mcp/tools/pdf.ts`
- Modify: `media/src/lib/mcp/server.ts`
- Modify: `media/src/lib/v1/router.ts` (`POST /v1/pdf`)
- Test: `media/test/pdf-build.test.ts`

- [ ] **Step 1 : Porter le builder PDF + test**

`media/src/lib/pdf/build.ts` : porter `contentos/src/lib/carousel/build-pdf.ts`, renommer `buildCarouselPdf`→`buildPdf`, type `CarouselSlide`→`PdfImage`. Logique (sniff PNG/JPEG, une image par page) inchangée. Si `size` non fourni, dimensionner chaque page aux dimensions de son image (utiliser `parseImageDimensions` de `@/lib/image-meta`) ; sinon garder le `size` global. Signature : `buildPdf(images: PdfImage[], size?: { width: number; height: number }): Promise<Buffer>`.

`media/test/pdf-build.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { buildPdf } from "@/lib/pdf/build";
import { PDFDocument } from "pdf-lib";

// PNG 1×1 transparent minimal.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("buildPdf", () => {
  it("rejette une liste vide", async () => {
    await expect(buildPdf([])).rejects.toThrow();
  });
  it("produit un PDF avec une page par image", async () => {
    const out = await buildPdf(
      [{ bytes: PNG_1x1, type: "image/png" }, { bytes: PNG_1x1, type: "image/png" }],
      { width: 100, height: 100 },
    );
    expect(out.subarray(0, 4).toString("latin1")).toBe("%PDF");
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });
  it("rejette un format non supporté (WebP)", async () => {
    await expect(
      buildPdf([{ bytes: Buffer.from("RIFFxxxxWEBP"), type: "image/webp" }], { width: 10, height: 10 }),
    ).rejects.toThrow();
  });
});
```

Run: `cd media && npx vitest run test/pdf-build.test.ts` → PASS.

- [ ] **Step 2 : Agrégateur**

`media/src/lib/pdf/aggregate.ts` :

```ts
import { getMediaRecord } from "@/lib/media/repository";
import { getImageBytes } from "@/lib/storage";
import { buildPdf, type PdfImage } from "./build";
import { store } from "@/lib/store";
import type { MediaRecord } from "@/lib/media/types";

// Agrège une liste ordonnée d'images (par id) en un PDF (une image par page).
export async function aggregatePdf(imageIds: string[]): Promise<MediaRecord> {
  if (imageIds.length === 0) throw new Error("Au moins une image requise");
  const images: PdfImage[] = [];
  let size: { width: number; height: number } | undefined;
  for (const id of imageIds) {
    const rec = await getMediaRecord(id);
    if (!rec) throw new Error(`Image introuvable: ${id}`);
    if (rec.kind !== "image" && rec.kind !== "render") throw new Error(`L'objet ${id} n'est pas une image`);
    const bytes = await getImageBytes(rec.r2_key);
    if (!bytes) throw new Error(`Octets absents pour ${id}`);
    images.push({ bytes: Buffer.from(bytes.bytes), type: bytes.contentType });
    if (!size && rec.width && rec.height) size = { width: rec.width, height: rec.height };
  }
  const pdf = await buildPdf(images, size);
  return store({
    bytes: new Uint8Array(pdf), mimeType: "application/pdf", kind: "pdf",
    prompt: null, parent_id: null, source: "pdf_aggregate", tags: [],
  });
}
```

- [ ] **Step 3 : Outil MCP `create_pdf` + `/v1/pdf`**

`media/src/lib/mcp/tools/pdf.ts` : `registerPdfTools(server)`, outil `create_pdf` (`image_ids: z.array(z.string()).min(1)`) → `aggregatePdf(...)`, `jsonResult({id,url})`.

`v1/router.ts` : `PdfSchema = z.object({ imageIds: z.array(z.string()).min(1) })`, `handlePdf` → `aggregatePdf`, route `POST /v1/pdf` → `{ id, url }`.

- [ ] **Step 4 : Enregistrer + typage + tests + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: construction de PDF depuis des images (pdf-lib) — MCP create_pdf + /v1/pdf"
```

---

## Task 7 : Upload généralisé (image / PDF / vidéo) avec validation

**Files:**
- Create: `media/src/lib/media/validate-upload.ts` (port + test)
- Modify: `media/src/lib/v1/router.ts` (`handleUpload` : `kind` + validation)
- Test: `media/test/validate-upload.test.ts`

- [ ] **Step 1 : Test de validation (échec)**

`media/test/validate-upload.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { validateUpload } from "@/lib/media/validate-upload";

describe("validateUpload", () => {
  it("accepte un PNG sous la limite", () => {
    expect(validateUpload("image/png", 5_000_000)).toEqual({ ok: true, kind: "image" });
  });
  it("refuse une image trop lourde", () => {
    expect(validateUpload("image/png", 20_000_000).ok).toBe(false);
  });
  it("accepte un PDF jusqu'à 100 Mo", () => {
    expect(validateUpload("application/pdf", 90_000_000)).toEqual({ ok: true, kind: "pdf" });
  });
  it("accepte une vidéo mp4 jusqu'à 500 Mo", () => {
    expect(validateUpload("video/mp4", 400_000_000)).toEqual({ ok: true, kind: "video" });
  });
  it("refuse un type non supporté", () => {
    expect(validateUpload("application/zip", 10).ok).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec)** — FAIL.

- [ ] **Step 3 : Implémenter `validate-upload.ts`**

```ts
import { kindForMime } from "./kind";
import type { MediaKind } from "./types";

const LIMITS: Record<string, number> = {
  "image/png": 10_000_000, "image/jpeg": 10_000_000, "image/webp": 10_000_000,
  "application/pdf": 100_000_000, "video/mp4": 500_000_000,
};

export type ValidateResult = { ok: true; kind: MediaKind } | { ok: false; error: string };

// Valide type MIME + taille d'un upload. Limites : image 10 Mo, pdf 100 Mo, mp4 500 Mo.
export function validateUpload(mime: string, sizeBytes: number): ValidateResult {
  const limit = LIMITS[mime];
  if (!limit) return { ok: false, error: `Type non supporté: ${mime}` };
  if (sizeBytes > limit) return { ok: false, error: `Fichier trop volumineux pour ${mime}` };
  return { ok: true, kind: kindForMime(mime) };
}
```

- [ ] **Step 4 : Lancer (succès)** — PASS.

- [ ] **Step 5 : Brancher dans `handleUpload`**

Dans `v1/router.ts` `handleUpload` : lire les octets, `validateUpload(mime, bytes.byteLength)` ; si `!ok` → `jsonResponse({ error }, 400)`. Sinon `store({ ..., kind: result.kind, source: "upload" })`.

- [ ] **Step 6 : Typage + tests + commit**

```bash
cd media && npx tsc --noEmit && npx vitest run
git add media/ && git commit -m "🤖 media: upload généralisé image/PDF/vidéo avec validation type + taille"
```

---

## Task 8 : Front-end — shell d'admin (layout, nav, helpers)

À partir d'ici, validation **manuelle sur la preview** (les pages React ne sont pas testées en unitaire). À chaque task front : `npx tsc --noEmit` + `npm run build` doivent passer.

**Files:**
- Modify: `media/src/app/page.tsx` (tableau de bord → liens admin)
- Create: `media/src/app/(admin)/layout.tsx` (garde de session + nav)
- Create: `media/src/lib/auth-guard.ts` (helper session serveur)

- [ ] **Step 1 : Helper de garde de session**

`media/src/lib/auth-guard.ts` : `requireSession()` — lit la session via `auth.api.getSession({ headers: await headers() })` (voir `@/lib/auth`), redirige vers `/sign-in` si absente. S'aligner sur le pattern d'auth serveur de `contentos/src/lib/auth/server.ts` adapté à BetterAuth de `media`.

- [ ] **Step 2 : Layout admin**

`media/src/app/(admin)/layout.tsx` : `await requireSession()`, puis une nav latérale sobre (liens : Galerie, Templates, Styles, Chartes, Marque) + `{children}`. Tailwind minimal (pas de design léché).

- [ ] **Step 3 : Page d'accueil**

`media/src/app/page.tsx` : titre + liens vers les sections d'admin (ou redirect vers `/gallery`).

- [ ] **Step 4 : Build + commit**

```bash
cd media && npx tsc --noEmit && npm run build
git add media/ && git commit -m "🤖 media: shell d'admin (layout, nav, garde de session)"
```

---

## Task 9 : Front-end — styles, chartes, marque (CRUD simples)

**Files:**
- Create: `media/src/app/(admin)/styles/page.tsx` + `actions.ts`
- Create: `media/src/app/(admin)/style-guides/page.tsx` + `actions.ts`
- Create: `media/src/app/(admin)/brand/page.tsx` + `actions.ts`

- [ ] **Step 1 : Styles**

`styles/actions.ts` : server actions `"use server"` appelant `createStyle/updateStyle/deleteStyle` (`@/lib/styles/repository`) puis `revalidatePath("/styles")`. `styles/page.tsx` (server component) : `listStyles()`, tableau (nom, prompt, supprimer) + formulaire create/edit (champs `name`, `prompt` en `<textarea>`). Pattern de référence pour les pages CRUD suivantes.

- [ ] **Step 2 : Chartes (style guides)**

Même pattern : `createGuide/updateGuide/deleteGuide`. `content` en `<textarea>` markdown (pas de rendu markdown nécessaire).

- [ ] **Step 3 : Marque**

`brand/page.tsx` : `getBrand()`, un seul formulaire (`name`, `signature`, `logo_url`) → action `upsertBrand`.

- [ ] **Step 4 : Build + commit**

```bash
cd media && npx tsc --noEmit && npm run build
git add media/ && git commit -m "🤖 media: UI admin styles / chartes / marque"
```

---

## Task 10 : Front-end — templates avec aperçu de rendu

**Files:**
- Create: `media/src/app/(admin)/templates/page.tsx` (liste)
- Create: `media/src/app/(admin)/templates/[id]/page.tsx` (éditeur)
- Create: `media/src/app/(admin)/templates/actions.ts`

- [ ] **Step 1 : Liste**

`templates/page.tsx` : `listTemplates()`, tableau (label, slug, dimensions) + bouton « nouveau » (crée un template vierge via action puis redirige vers l'éditeur).

- [ ] **Step 2 : Éditeur + aperçu**

`templates/[id]/page.tsx` : formulaire (slug, label, width, height, body_html, css, variables_schema en JSON `<textarea>`, sample_vars en JSON, style_guide_id en `<select>` depuis `listGuides()`). Action `save` → `updateTemplate`. Action `preview` → `renderTemplate(id, sampleVars, { imagesOptional: true })` puis afficher `<img src={rec.url}>`. Garder l'UI sobre.

- [ ] **Step 3 : Build + commit**

```bash
cd media && npx tsc --noEmit && npm run build
git add media/ && git commit -m "🤖 media: UI admin templates + aperçu de rendu"
```

---

## Task 11 : Front-end — galerie + upload manuel

**Files:**
- Create: `media/src/app/(admin)/gallery/page.tsx`
- Create: `media/src/app/(admin)/gallery/actions.ts`

- [ ] **Step 1 : Galerie**

`gallery/page.tsx` : `listMediaRecords({ limit: 100 })` (+ filtre `kind` via query param `?kind=`). Grille : pour `image`/`render` → `<img>` ; `video` → `<video controls>` ; `pdf` → lien + icône. Chaque item : id, dimensions, bouton supprimer (action → `deleteMediaRow` + `deleteObject`, comme `delete_image`).

- [ ] **Step 2 : Upload**

`gallery/actions.ts` : action `upload` recevant un `FormData` (`<input type="file">`). Lire le fichier (`file.arrayBuffer()`), `validateUpload(file.type, bytes.byteLength)`, puis `store({ bytes, mimeType: file.type, kind, source: "upload", ... })`. `revalidatePath("/gallery")`. Formulaire d'upload simple en haut de la galerie.

- [ ] **Step 3 : Build + commit**

```bash
cd media && npx tsc --noEmit && npm run build
git add media/ && git commit -m "🤖 media: UI galerie des médias + upload manuel"
```

---

## Task 12 : Seed de démonstration

**Files:**
- Modify: `media/scripts/seed.mjs`

- [ ] **Step 1 : Écrire le seed**

`seed.mjs` (preview uniquement) : se connecter via `postgres(DATABASE_URL)`, insérer si absent :
- 1 ligne `brand` (`id:"brand"`, name `"AVQN"`, signature `"— Manu"`).
- 2 `visual_styles` : « 3D doux » (prompt décrivant un rendu 3D doux, éclairage studio) et « Flat 2D » (illustration vectorielle plate).
- 1 `style_guides` : « Charte AVQN » avec un markdown court (palette, typographie).
- 1–2 `visual_templates` : porter `linkedin-horizontal` (et éventuellement un format carré) depuis `contentos/src/lib/visual-templates/seeds/linkedin-horizontal.ts` — copier `bodyHtml`, `css`, `variablesSchema`, `sampleVars`, `width`, `height`. Idempotent (`ON CONFLICT (slug) DO NOTHING`). N'utiliser que `postgres` (dep de prod, comme `migrate.mjs`).

- [ ] **Step 2 : Vérifier la syntaxe + commit**

```bash
cd media && node --check scripts/seed.mjs
git add media/ && git commit -m "🤖 media: seed de démonstration (marque, styles, charte, templates)"
```

---

## Task 13 : Doc + déploiement preview + validation

**Files:**
- Modify: `media/CLAUDE.md` (interfaces : nouveaux outils MCP + routes `/v1` + UIs)

- [ ] **Step 1 : Mettre à jour `media/CLAUDE.md`**

Réécrire les sections « Interfaces » et « Besoins déclarés » pour décrire l'état cible (instantané, pas d'historique — cf. CLAUDE.md global) : liste complète des outils MCP (génération, édition, render_html, render_template, templates/styles/guides/brand CRUD, create_pdf, list/get/delete) ; routes `/v1` (generate, edit, render-html, render-template, pdf, upload, delete) ; pages d'admin. Mentionner les deps `handlebars`/`pdf-lib`. Aucune nouvelle variable de secret.

- [ ] **Step 2 : Vérification finale locale**

```bash
cd media && npx tsc --noEmit && npx vitest run && npm run build
```
Expected: tout vert.

- [ ] **Step 3 : Commit + push (preview)**

```bash
git add media/ && git commit -m "🤖 media: doc des interfaces (centre des médias)"
git push -u origin work/media-migration-contentos
```

- [ ] **Step 4 : Suivre le déploiement preview**

```bash
gh run watch
```
La preview se déploie sur `https://media-work-media-migration-contentos.lab.avqn.ch` (host attribué par la plateforme ; confirmer l'URL exacte dans les logs de l'action ou via `lab-deploy`).

- [ ] **Step 5 : Valider le runtime sur la preview (sans mock)**

Checklist manuelle (login magic-link puis) :
- UI : galerie, upload d'une image, création d'un style / charte / marque, création + aperçu d'un template (rendu réel via browserless).
- `/v1` (avec `MEDIA_ENGINE_SERVICE_KEY`) : `POST /v1/render-template`, `POST /v1/pdf`, `POST /v1/generate` avec `styleId`, `POST /v1/upload` (pdf + mp4). Les routes existantes restent OK.
- Note : `generate_image`/`/v1/generate` dépend de `GEMINI_API_KEY` (cf. mémoire `media-provisioning` : potentiellement absent du coffre) — si la génération échoue, vérifier/poser le secret via `/lab-secret` avant de conclure.

- [ ] **Step 6 : Signaler à Manu**

Donner l'URL de preview et le récapitulatif des capacités à tester.

---

## Self-review (couverture spec)

- §3 Modèle d'objet `media`/`kind` → Task 1. ✓
- §4 Tables `media`/`visual_styles`/`style_guides`/`visual_templates`/`brand` + migration rename → Task 1. ✓
- §5 Templating (DSL, compile, brand, render) → Tasks 4 (brand context) + 5. ✓
- §6 Styles (style_id) → Task 2 ; PDF → Task 6 ; upload pdf/vidéo → Task 7. ✓
- §7 MCP (styles/guides/brand/templates/pdf + render_template + style_id) → Tasks 2,3,4,5,6 ; `/v1` render-template/pdf/generate(styleId) → Tasks 5,6,2 ; UI (styles/guides/brand/templates/galerie+upload) → Tasks 8-11. ✓
- §8 Pas de nouveau secret ; deps handlebars/pdf-lib → Task 1. ✓
- §9 Tests logique pure → Tasks 1,2,4,5,6,7 ; runtime sur preview → Task 13. ✓
- §10 Seed → Task 12. ✓
- §11 Mise en service preview → Task 13. ✓
- §12 Risque rename `images`→`media` traité explicitement → Task 1 Step 7. ✓
