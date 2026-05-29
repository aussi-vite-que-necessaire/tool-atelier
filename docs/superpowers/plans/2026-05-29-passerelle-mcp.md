# Passerelle MCP — tranche `media` pilote — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer un unique serveur MCP public `mcp.contentos.ch` qui fédère les tools de `media`, `media` devenant un backend interne (service-key + `userId` transmis), sans plus aucun MCP public ni base64 côté `media`.

**Architecture:** Deux moitiés. (1) `media` perd sa porte OAuth/MCP et expose un contrat interne générique `GET /internal/tools` (schémas JSON) + `POST /internal/tools/:name` (`{userId,args}`), dérivé d'un registre de tools `{name,description,inputSchema(Zod),handler(userId,args)}`. (2) Nouveau projet `projects/mcp/` (Next.js, sans DB) : porte OAuth unique, registre statique de backends, client interne, et handlers MCP **bas-niveau** `tools/list`/`tools/call` qui relaient vers `media` en préfixant les noms (`media_*`).

**Tech Stack:** Next.js 16 (App Router, standalone), TypeScript, Zod 4 (`z.toJSONSchema`), `mcp-handler` + `@modelcontextprotocol/sdk` (passerelle uniquement), Vitest. Auth déléguée à `auth.contentos.ch` (inchangée).

**Référence spec :** `docs/superpowers/specs/2026-05-29-passerelle-mcp-design.md` — **cadre ADR :** `docs/decisions/0003-passerelle-mcp-centrale.md`.

---

## File Structure

### Phase A — `media` devient un backend interne (`projects/media/`)

- Create `src/lib/mcp/types.ts` — type `ToolDef` + `ToolResult` (contrat du registre).
- Modify `src/lib/mcp/result.ts` — garder `jsonResult`, **supprimer `imageResult`**, ajouter `errorResult`.
- Modify `src/lib/mcp/tools/images.ts` (NOUVEAU, extrait de `server.ts`) — 6 tools image en `ToolDef[]`.
- Modify `src/lib/mcp/tools/{styles,style-guides,brand,templates,pdf}.ts` — passent de `register*(server)` à `export const *Tools: ToolDef[]`.
- Create `src/lib/mcp/registry.ts` — agrège tous les `ToolDef[]` + `toolsByName` Map.
- Create `src/lib/mcp/internal.ts` — `listToolsResponse()` et `callToolByName(name,userId,args)`.
- Create `src/app/internal/tools/route.ts` — `GET` (service-key → liste).
- Create `src/app/internal/tools/[name]/route.ts` — `POST` (service-key → exécution).
- Delete `src/lib/mcp/server.ts`, `src/lib/mcp/auth.ts`, `src/app/api/mcp/route.ts`, `src/app/.well-known/oauth-authorization-server/route.ts`, `src/app/.well-known/oauth-protected-resource/route.ts`.
- Modify `src/middleware.ts` — matcher : `api/mcp`+`.well-known` → `internal`.
- Modify `test/mcp-server.test.ts` → `test/mcp-internal.test.ts` (registre + JSON Schema, sans DB).
- Modify `package.json` — retirer `mcp-handler` et `@modelcontextprotocol/sdk` (plus utilisés ; Zod suffit).

### Phase B — la passerelle (`projects/mcp/`, nouveau projet)

- Create base Next.js (copie de `starters/base/`, placeholders substitués `mcp` / description).
- Create `src/lib/env.ts` — `APP_URL`, `AUTH_URL`, `APP_ENV`, `MEDIA_INTERNAL_URL`, `MEDIA_SERVICE_KEY`.
- Create `src/lib/auth/preview.ts` — `isPreview`, `PREVIEW_USER_ID` (copie media).
- Create `src/lib/mcp/auth.ts` — `verifyMcpToken` (fetch `AUTH_URL/api/auth/mcp/get-session`) + `userIdFrom`.
- Create `src/lib/backends.ts` — registre statique `[{prefix,baseUrl,serviceKey}]`.
- Create `src/lib/backend-client.ts` — `listTools(backend)`, `callTool(backend,name,userId,args)`.
- Create `src/lib/mcp/gateway.ts` — `registerGateway(server)` : pose les handlers bas-niveau `tools/list`/`tools/call`.
- Create `src/app/api/mcp/route.ts` — `createMcpHandler` + `withMcpAuth`.
- Create `src/app/.well-known/oauth-protected-resource/route.ts` + `oauth-authorization-server/route.ts`.
- Create `src/middleware.ts` — laisse passer `api/mcp` + `.well-known` + `healthz`.
- Create `lab.json` (sans db), `vitest.config.ts`, `package.json` (next/react + mcp-handler + sdk + zod + vitest).
- Create `test/backend-client.test.ts`, `test/gateway.test.ts` (fetch mocké, sans DB ni réseau).
- Create `CLAUDE.md` du projet.

---

## PHASE A — `media` backend interne

### Task A1 : Type du registre de tools

**Files:**
- Create: `projects/media/src/lib/mcp/types.ts`

- [ ] **Step 1: Écrire le type** (pas de test : déclaration de types pure)

```typescript
import type { ZodRawShape } from "zod";

// Bloc de contenu MCP renvoyé par un tool. URL-only : jamais de binaire/base64.
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// Définition d'un tool, indépendante du transport (MCP public retiré).
// inputSchema = raw shape Zod (comme l'ancien registerTool). userId est fourni
// par l'appelant de confiance (la passerelle), plus par un token OAuth local.
export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (userId: string, args: Record<string, unknown>) => Promise<ToolResult>;
};
```

- [ ] **Step 2: Commit**

```bash
git add projects/media/src/lib/mcp/types.ts
git commit -m "media: type ToolDef pour le registre de tools interne"
```

### Task A2 : `result.ts` — URL-only + errorResult

**Files:**
- Modify: `projects/media/src/lib/mcp/result.ts`

- [ ] **Step 1: Réécrire le fichier** (supprime `imageResult`, garde `jsonResult`, ajoute `errorResult`)

```typescript
import type { ToolResult } from "./types";

// Enveloppe une valeur en content block texte (JSON). URL-only : les tools
// image renvoient { id, url, ... }, jamais les octets.
export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

// Erreur métier (entité introuvable, pré-condition) → résultat MCP isError.
export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
```

- [ ] **Step 2: Vérifier qu'aucun import de `imageResult`/`bytesToBase64` ne subsiste hors des fichiers réécrits par ce plan**

Run: `cd projects/media && grep -rn "imageResult" src/ | grep -v "src/lib/mcp/tools/images.ts"`
Expected: aucune ligne (les seuls usages seront recréés en A3 sous forme URL-only — donc zéro ici).

- [ ] **Step 3: Commit**

```bash
git add projects/media/src/lib/mcp/result.ts
git commit -m "media: result URL-only (drop imageResult) + errorResult"
```

### Task A3 : Tools image en `ToolDef[]` (extrait de `server.ts`)

**Files:**
- Create: `projects/media/src/lib/mcp/tools/images.ts`
- Test: `projects/media/test/mcp-internal.test.ts` (créé en A9 ; ici on ne teste pas l'exécution DB)

Les 6 tools actuellement dans `server.ts` (`generate_image`, `edit_image`, `render_html`, `list_images`, `get_image`, `delete_image`) deviennent des `ToolDef`. **Recette de transformation, identique pour chaque tool :**
- `server.registerTool(name, {description, inputSchema}, async (args, extra) => {…})` → `{ name, description, inputSchema, handler: async (userId, args) => {…} }`.
- supprimer `const userId = userIdFrom(extra);` (le `userId` est le paramètre).
- remplacer tout `imageResult(bytes, mimeType, meta)` par `jsonResult(meta)` (URL-only : on jette `bytes`/`mimeType`, on garde l'objet métadonnées qui contient déjà `id`/`url`).
- corps métier (appels `generateImage`, `store`, `getMediaRecord`…) **inchangés**.

- [ ] **Step 1: Écrire `images.ts`** (corps repris verbatim de `server.ts`, transformés selon la recette)

```typescript
import { z } from "zod";
import { generateImage, editImage } from "@/lib/gemini";
import { renderHtml } from "@/lib/render";
import { getImageBytes, deleteObject } from "@/lib/storage";
import { getMediaRecord, listMediaRecords, deleteMediaRow } from "@/lib/media/repository";
import { store } from "@/lib/store";
import { getStyle } from "@/lib/styles/repository";
import { composePrompt } from "@/lib/styles/compose";
import { jsonResult } from "../result";
import type { ToolDef } from "../types";

export const imageTools: ToolDef[] = [
  {
    name: "generate_image",
    description:
      "Génère une image à partir d'un prompt texte (Gemini Nano Banana). Retourne l'URL publique.",
    inputSchema: {
      prompt: z.string().min(1).describe("Description détaillée de l'image : sujet, style, composition, couleurs, ambiance."),
      aspect_ratio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional().describe("Ratio de l'image. Défaut 1:1. 16:9 paysage, 9:16 portrait/story, 4:3 classique."),
      tags: z.array(z.string()).optional().describe("Étiquettes libres pour retrouver l'image via list_images, ex: ['linkedin','tech']."),
      style_id: z.string().optional().describe("id d'un style visuel (list_visual_styles) à appliquer. Son prompt est ajouté en suffixe au prompt fourni."),
    },
    handler: async (userId, args) => {
      const { prompt, aspect_ratio, tags, style_id } = args as {
        prompt: string; aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:3"; tags?: string[]; style_id?: string;
      };
      const st = style_id ? await getStyle(userId, style_id) : undefined;
      const finalPrompt = composePrompt(prompt, st?.prompt);
      const { bytes, mimeType } = await generateImage(finalPrompt, aspect_ratio ?? "1:1");
      const rec = await store({
        userId, bytes, mimeType, kind: "image", prompt: finalPrompt,
        parent_id: null, source: "gemini_generate", tags: tags ?? [], style_id: style_id ?? null,
      });
      return jsonResult({ id: rec.id, url: rec.url, prompt: rec.prompt, width: rec.width, height: rec.height });
    },
  },
  {
    name: "edit_image",
    description:
      "Édite une image existante (par son id) avec un prompt, via Gemini. Crée une nouvelle image liée à la source.",
    inputSchema: {
      image_id: z.string().min(1).describe("id d'une image existante (issu de generate_image, render_html ou list_images) servant de source."),
      edit_prompt: z.string().min(1).describe("Modification à appliquer, en langage naturel. Ex: 'assombris le fond', 'ajoute un chapeau rouge'."),
      tags: z.array(z.string()).optional().describe("Étiquettes libres pour retrouver la variante via list_images."),
    },
    handler: async (userId, args) => {
      const { image_id, edit_prompt, tags } = args as { image_id: string; edit_prompt: string; tags?: string[] };
      const source = await getMediaRecord(userId, image_id);
      if (!source) throw new Error(`Image introuvable: ${image_id}`);
      const src = await getImageBytes(source.r2_key);
      if (!src) throw new Error(`Fichier source absent du bucket: ${source.r2_key}`);
      const { bytes, mimeType } = await editImage(src.bytes, src.contentType, edit_prompt);
      const rec = await store({
        userId, bytes, mimeType, kind: "image", prompt: edit_prompt,
        parent_id: source.id, source: "gemini_edit", tags: tags ?? [],
      });
      return jsonResult({ id: rec.id, url: rec.url, prompt: rec.prompt, parent_id: rec.parent_id, width: rec.width, height: rec.height });
    },
  },
  {
    name: "render_html",
    description:
      "Rend un HTML autonome en image aux dimensions données (Chromium partagé). L'agent fournit tout le HTML/CSS. " +
      "Tailles courantes : Open Graph 1200×630, carré 1080×1080, story 1080×1920, cover article 1200×675. " +
      "format défaut png ; webp/jpeg (avec quality) pour alléger les visuels typographiques. " +
      "wait_for : sélecteur CSS à attendre ou délai en ms si le contenu se charge en JS.",
    inputSchema: {
      html: z.string().min(1).describe("HTML complet et autonome (CSS inline ou via <link>/CDN, polices incluses). Aucune substitution côté serveur."),
      width: z.number().int().positive().describe("Largeur du viewport en pixels (= largeur de l'image)."),
      height: z.number().int().positive().describe("Hauteur du viewport en pixels (= hauteur de l'image)."),
      format: z.enum(["png", "webp", "jpeg"]).optional().describe("Format de sortie. Défaut png. webp/jpeg (avec quality) allègent 3-5× les visuels typographiques."),
      quality: z.number().int().min(1).max(100).optional().describe("Qualité 1-100 pour webp/jpeg. Ignoré en png."),
      wait_for: z.union([z.string(), z.number().int().positive()]).optional().describe("Sélecteur CSS à attendre, ou délai en ms (max 15000), si le contenu se charge en JS. Sinon inutile."),
      tags: z.array(z.string()).optional().describe("Étiquettes libres pour retrouver l'image via list_images."),
    },
    handler: async (userId, args) => {
      const { html, width, height, format, quality, wait_for, tags } = args as {
        html: string; width: number; height: number; format?: "png" | "webp" | "jpeg"; quality?: number; wait_for?: string | number; tags?: string[];
      };
      const { bytes, mimeType } = await renderHtml({ html, width, height, format, quality, waitFor: wait_for });
      const rec = await store({
        userId, bytes, mimeType, kind: "render", prompt: null,
        parent_id: null, source: "html_render", tags: tags ?? [], width, height,
      });
      return jsonResult({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
    },
  },
  {
    name: "list_images",
    description:
      "Liste les images (tri par date décroissante). Filtres optionnels : recherche sur prompt, tags (intersection), source.",
    inputSchema: {
      query: z.string().optional().describe("Recherche texte sur le prompt (correspondance partielle)."),
      tags: z.array(z.string()).optional().describe("Filtre par tags : toutes les tags fournies doivent être présentes (intersection)."),
      source: z.enum(["gemini_generate", "gemini_edit", "html_render", "template_render", "upload", "pdf_aggregate"]).optional().describe("Filtre par origine."),
      limit: z.number().int().min(1).max(100).optional().describe("Nombre max de résultats. Défaut 20, max 100."),
    },
    handler: async (userId, args) => {
      const { query, tags, source, limit } = args as {
        query?: string; tags?: string[]; source?: string; limit?: number;
      };
      const records = await listMediaRecords(userId, { query, tags, source: source as never, limit });
      return jsonResult(records);
    },
  },
  {
    name: "get_image",
    description: "Récupère les métadonnées d'une image par son id (null si inconnue).",
    inputSchema: { image_id: z.string().min(1).describe("id de l'image à récupérer.") },
    handler: async (userId, args) => {
      const { image_id } = args as { image_id: string };
      return jsonResult(await getMediaRecord(userId, image_id));
    },
  },
  {
    name: "delete_image",
    description: "Supprime une image (objet R2 + ligne Postgres). Renvoie deleted:false si l'id est inconnu.",
    inputSchema: { image_id: z.string().min(1).describe("id de l'image à supprimer définitivement.") },
    handler: async (userId, args) => {
      const { image_id } = args as { image_id: string };
      const rec = await getMediaRecord(userId, image_id);
      if (!rec) return jsonResult({ deleted: false });
      const deleted = await deleteMediaRow(userId, image_id);
      if (deleted) await deleteObject(rec.r2_key);
      return jsonResult({ deleted });
    },
  },
];
```

- [ ] **Step 2: Vérifier la compilation du fichier** (typecheck rapide, sans DB)

Run: `cd projects/media && npx tsc --noEmit`
Expected: pas d'erreur dans `images.ts` (des erreurs subsisteront tant que `registry.ts`/`server.ts` ne sont pas faits — vérifier visuellement qu'aucune ne pointe `images.ts`).

- [ ] **Step 3: Commit**

```bash
git add projects/media/src/lib/mcp/tools/images.ts
git commit -m "media: tools image en ToolDef[] (URL-only, userId paramètre)"
```

### Task A4 : Convertir `styles.ts`, `style-guides.ts`, `brand.ts`, `templates.ts`, `pdf.ts`

**Files:**
- Modify: `projects/media/src/lib/mcp/tools/styles.ts`
- Modify: `projects/media/src/lib/mcp/tools/style-guides.ts`
- Modify: `projects/media/src/lib/mcp/tools/brand.ts`
- Modify: `projects/media/src/lib/mcp/tools/templates.ts`
- Modify: `projects/media/src/lib/mcp/tools/pdf.ts`

Même recette qu'en A3, appliquée à chaque fichier. Ces fichiers utilisent déjà `jsonResult` (pas d'image) → seul change la forme (registerTool → ToolDef) et la source du `userId`.

- [ ] **Step 1: Transformer chaque fichier**

Pour chaque fichier `X.ts` exportant aujourd'hui `export function register<Y>Tools(server: McpServer): void { server.registerTool(...) ... }` :
1. Remplacer l'en-tête d'import `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";` et `import { userIdFrom } from "@/lib/mcp/auth";` par `import type { ToolDef } from "../types";`.
2. Remplacer la fonction `register<Y>Tools` par `export const <y>Tools: ToolDef[] = [ ... ];`.
3. Chaque `server.registerTool("name", { description, inputSchema }, async (args, extra) => {…})` devient `{ name: "name", description, inputSchema, handler: async (userId, args) => {…} }`.
4. Supprimer `const userId = userIdFrom(extra);`. Typer la destructuration des `args` (ex. `const { style_id, name, prompt } = args as { style_id: string; name?: string; prompt?: string };`).
5. Corps métier inchangé. Remplacer les rares `return jsonResult({ error: "..." })` métier par `return errorResult("...")` (import `errorResult` depuis `../result`) pour porter `isError`.

Noms attendus par fichier (à conserver) :
- `styles.ts` → `styleTools` : `list_visual_styles`, `create_visual_style`, `update_visual_style`, `delete_visual_style`.
- `style-guides.ts` → `styleGuideTools` : `list_style_guides`, `get_style_guide`, `create_style_guide`, `update_style_guide`, `delete_style_guide`.
- `brand.ts` → `brandTools` : `get_brand`, `update_brand`.
- `templates.ts` → `templateTools` : `list_visual_templates`, `get_visual_template`, `create_visual_template`, `update_visual_template`, `delete_visual_template`, `render_template`.
- `pdf.ts` → `pdfTools` : `create_pdf`.

- [ ] **Step 2: Commit**

```bash
git add projects/media/src/lib/mcp/tools/styles.ts projects/media/src/lib/mcp/tools/style-guides.ts projects/media/src/lib/mcp/tools/brand.ts projects/media/src/lib/mcp/tools/templates.ts projects/media/src/lib/mcp/tools/pdf.ts
git commit -m "media: tools styles/guides/brand/templates/pdf en ToolDef[]"
```

### Task A5 : Registre

**Files:**
- Create: `projects/media/src/lib/mcp/registry.ts`

- [ ] **Step 1: Écrire le registre**

```typescript
import type { ToolDef } from "./types";
import { imageTools } from "./tools/images";
import { styleTools } from "./tools/styles";
import { styleGuideTools } from "./tools/style-guides";
import { brandTools } from "./tools/brand";
import { templateTools } from "./tools/templates";
import { pdfTools } from "./tools/pdf";

export const tools: ToolDef[] = [
  ...imageTools,
  ...styleTools,
  ...styleGuideTools,
  ...brandTools,
  ...templateTools,
  ...pdfTools,
];

export const toolsByName = new Map<string, ToolDef>(tools.map((t) => [t.name, t]));
```

- [ ] **Step 2: Commit**

```bash
git add projects/media/src/lib/mcp/registry.ts
git commit -m "media: registre des tools (agrégation + index par nom)"
```

### Task A6 : Contrat interne (`internal.ts`) — TDD

**Files:**
- Create: `projects/media/src/lib/mcp/internal.ts`
- Test: `projects/media/test/mcp-internal.test.ts`

- [ ] **Step 1: Écrire le test d'abord** (sans DB : on teste la sérialisation des schémas, la validation et le tool inconnu)

```typescript
import { describe, it, expect } from "vitest";
import { listToolsResponse, callToolByName } from "@/lib/mcp/internal";

describe("listToolsResponse", () => {
  it("expose les 24 tools attendus avec un inputSchema JSON Schema", () => {
    const { tools } = listToolsResponse();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "create_pdf", "create_style_guide", "create_visual_style", "create_visual_template",
        "delete_image", "delete_style_guide", "delete_visual_style", "delete_visual_template",
        "edit_image", "generate_image", "get_brand", "get_image", "get_style_guide",
        "get_visual_template", "list_images", "list_style_guides", "list_visual_styles",
        "list_visual_templates", "render_html", "render_template", "update_brand",
        "update_style_guide", "update_visual_style", "update_visual_template",
      ].sort(),
    );
    const gen = tools.find((t) => t.name === "generate_image")!;
    // JSON Schema, pas un objet Zod : type "object" + properties.prompt présent.
    expect(gen.inputSchema).toMatchObject({ type: "object" });
    expect((gen.inputSchema as { properties: Record<string, unknown> }).properties).toHaveProperty("prompt");
  });
});

describe("callToolByName", () => {
  it("rejette un tool inconnu", async () => {
    await expect(callToolByName("inexistant", "u1", {})).rejects.toThrow(/inconnu/i);
  });

  it("rejette des args invalides (validation Zod)", async () => {
    // generate_image exige prompt:string non vide → args vides invalides.
    await expect(callToolByName("generate_image", "u1", {})).rejects.toThrow(/prompt|invalide|required/i);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd projects/media && npx vitest run test/mcp-internal.test.ts`
Expected: FAIL — `internal.ts` n'existe pas encore.

- [ ] **Step 3: Écrire l'implémentation**

```typescript
import { z } from "zod";
import { tools, toolsByName } from "./registry";
import { errorResult } from "./result";
import type { ToolResult } from "./types";

// Catalogue : nom + description + JSON Schema (Zod → JSON Schema via Zod v4).
export function listToolsResponse() {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(z.object(t.inputSchema)),
    })),
  };
}

// Exécute un tool par nom : valide les args contre son schéma Zod, puis appelle
// le handler avec le userId fourni (de confiance, transmis par la passerelle).
// Une erreur métier (throw) est convertie en résultat MCP isError par l'appelant
// HTTP ; ici on laisse remonter pour les cas tool inconnu / args invalides.
export async function callToolByName(
  name: string,
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const tool = toolsByName.get(name);
  if (!tool) throw new Error(`Tool inconnu: ${name}`);
  const parsed = z.object(tool.inputSchema).safeParse(args ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Arguments invalides");
  }
  try {
    return await tool.handler(userId, parsed.data as Record<string, unknown>);
  } catch (e) {
    // Erreur métier → résultat isError (pas une 500 transport).
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `cd projects/media && npx vitest run test/mcp-internal.test.ts`
Expected: PASS (3 tests). Note : `callToolByName("generate_image", …, {})` doit échouer à la **validation** (avant tout appel DB/Gemini), donc rejette bien sans toucher d'infra.

- [ ] **Step 5: Supprimer l'ancien test MCP serveur**

```bash
cd projects/media && git rm test/mcp-server.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add projects/media/src/lib/mcp/internal.ts projects/media/test/mcp-internal.test.ts
git commit -m "media: contrat interne listTools/callTool + tests (sans DB)"
```

### Task A7 : Routes HTTP `/internal/tools` — TDD

**Files:**
- Create: `projects/media/src/app/internal/tools/route.ts`
- Create: `projects/media/src/app/internal/tools/[name]/route.ts`
- Test: `projects/media/test/internal-routes.test.ts`

- [ ] **Step 1: Écrire le test d'abord** (garde service-key ; pas de DB car on teste l'auth et le 404 tool inconnu)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { GET as listTools } from "@/app/internal/tools/route";
import { POST as callTool } from "@/app/internal/tools/[name]/route";

const KEY = "test-internal-key";
function req(body?: unknown, key?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return new Request("https://media.internal/internal/tools", {
    method: "POST", headers, body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/internal/tools", () => {
  beforeEach(() => { process.env.MEDIA_ENGINE_SERVICE_KEY = KEY; });

  it("GET refuse sans service-key (401)", async () => {
    const res = await listTools(new Request("https://media.internal/internal/tools"));
    expect(res.status).toBe(401);
  });

  it("GET liste les tools avec service-key", async () => {
    const res = await listTools(
      new Request("https://media.internal/internal/tools", { headers: { Authorization: `Bearer ${KEY}` } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBe(24);
  });

  it("POST refuse sans service-key (401)", async () => {
    const res = await callTool(req({ userId: "u1", args: {} }), { params: Promise.resolve({ name: "get_brand" }) });
    expect(res.status).toBe(401);
  });

  it("POST 400 si userId manquant", async () => {
    const res = await callTool(req({ args: {} }, KEY), { params: Promise.resolve({ name: "get_brand" }) });
    expect(res.status).toBe(400);
  });

  it("POST 404 pour un tool inconnu", async () => {
    const res = await callTool(req({ userId: "u1", args: {} }, KEY), { params: Promise.resolve({ name: "inexistant" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd projects/media && npx vitest run test/internal-routes.test.ts`
Expected: FAIL — routes inexistantes.

- [ ] **Step 3: Écrire `route.ts` (GET liste)**

```typescript
import { checkServiceKey } from "@/lib/service-auth";
import { listToolsResponse } from "@/lib/mcp/internal";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  if (!checkServiceKey(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify(listToolsResponse()), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
```

- [ ] **Step 4: Écrire `[name]/route.ts` (POST exécution)**

```typescript
import { checkServiceKey } from "@/lib/service-auth";
import { callToolByName } from "@/lib/mcp/internal";

export const dynamic = "force-dynamic";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ name: string }> },
): Promise<Response> {
  if (!checkServiceKey(request)) return json({ error: "Unauthorized" }, 401);

  const { name } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }
  const { userId, args } = (body ?? {}) as { userId?: unknown; args?: unknown };
  if (typeof userId !== "string" || userId.length === 0) {
    return json({ error: "userId manquant" }, 400);
  }
  try {
    const result = await callToolByName(name, userId, args ?? {});
    return json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = /inconnu/i.test(message) ? 404 : 400;
    return json({ error: message }, status);
  }
}
```

- [ ] **Step 5: Lancer le test, vérifier qu'il passe**

Run: `cd projects/media && npx vitest run test/internal-routes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/media/src/app/internal/tools/route.ts "projects/media/src/app/internal/tools/[name]/route.ts" projects/media/test/internal-routes.test.ts
git commit -m "media: routes /internal/tools (GET liste, POST exécution) + tests"
```

### Task A8 : Retrait de la porte MCP/OAuth publique

**Files:**
- Delete: `projects/media/src/lib/mcp/server.ts`
- Delete: `projects/media/src/lib/mcp/auth.ts`
- Delete: `projects/media/src/app/api/mcp/route.ts`
- Delete: `projects/media/src/app/.well-known/oauth-authorization-server/route.ts`
- Delete: `projects/media/src/app/.well-known/oauth-protected-resource/route.ts`
- Modify: `projects/media/src/middleware.ts`
- Modify: `projects/media/package.json`

- [ ] **Step 1: Supprimer les fichiers de la porte publique**

```bash
cd projects/media
git rm src/lib/mcp/server.ts src/lib/mcp/auth.ts src/app/api/mcp/route.ts \
  src/app/.well-known/oauth-authorization-server/route.ts \
  src/app/.well-known/oauth-protected-resource/route.ts
```

- [ ] **Step 2: Mettre à jour le matcher du middleware** (`api/mcp`+`.well-known` → `internal`)

Dans `projects/media/src/middleware.ts`, remplacer la ligne du matcher par :

```typescript
    "/((?!healthz|sign-in|internal|v1|_next|favicon).*)",
```

- [ ] **Step 3: Retirer les deps MCP devenues inutiles** dans `projects/media/package.json`

Supprimer les deux lignes `"@modelcontextprotocol/sdk": "^1.26.0",` et `"mcp-handler": "^1.1.0",` du bloc `dependencies`.

- [ ] **Step 4: Vérifier qu'aucune référence orpheline ne subsiste**

Run: `cd projects/media && grep -rn "mcp-handler\|@modelcontextprotocol\|lib/mcp/auth\|lib/mcp/server\|withMcpAuth\|imageResult" src/ test/`
Expected: aucune ligne.

- [ ] **Step 5: Typecheck complet du projet**

Run: `cd projects/media && npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add -A projects/media
git commit -m "media: retire la porte MCP/OAuth publique (gateway-only), deps + middleware"
```

### Task A9 : Vérification des tests DB-free de `media`

**Files:** (aucun ; vérification)

- [ ] **Step 1: Lancer les tests sans DB qui ne dépendent pas de Postgres**

Run: `cd projects/media && npx vitest run test/mcp-internal.test.ts test/internal-routes.test.ts test/service-auth.test.ts test/base64.test.ts`
Expected: PASS. (Le reste de la suite — repository/store — exige Postgres et sera vérifié en CI ; cf. note de fin de plan.)

- [ ] **Step 2: Commit** (rien à committer si tout passe ; sinon corriger et committer)

---

## PHASE B — la passerelle `projects/mcp/`

### Task B1 : Scaffolding du projet (base Next.js)

**Files:**
- Create: arborescence `projects/mcp/` depuis `starters/base/`.

- [ ] **Step 1: Copier la base et substituer les placeholders**

```bash
cd /Users/ManuAVQN/Code/atelier
mkdir -p projects/mcp
cp -R starters/base/. projects/mcp/
# Substituer les placeholders du starter.
cd projects/mcp
sed -i '' 's/__PROJECT_NAME__/mcp/g; s/__DESCRIPTION__/passerelle MCP centrale (mcp.contentos.ch) — fédère les tools de la suite./g' package.json lab.json CLAUDE.md
```

- [ ] **Step 2: Vérifier le contenu de `lab.json`** (pas de db)

Run: `cat projects/mcp/lab.json`
Expected: `{ "description": "passerelle MCP centrale ..." }` — **aucune** capacité `db`/`redis`.

- [ ] **Step 3: Ajouter les dépendances runtime à `projects/mcp/package.json`**

Dans `dependencies`, ajouter (en plus de next/react/react-dom) :

```json
    "@modelcontextprotocol/sdk": "^1.26.0",
    "mcp-handler": "^1.1.0",
    "zod": "^4.4.3"
```

Dans `devDependencies`, ajouter `"vitest": "^4.1.7"`. Ajouter le script `"test": "vitest run"` dans `scripts`.

- [ ] **Step 4: Créer `projects/mcp/vitest.config.ts`** (copie de media)

```typescript
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 5: Installer les deps + commit**

```bash
cd projects/mcp && npm install
git add -A projects/mcp
git commit -m "mcp: scaffolding passerelle (base Next.js sans DB)"
```

### Task B2 : env + preview

**Files:**
- Create: `projects/mcp/src/lib/env.ts`
- Create: `projects/mcp/src/lib/auth/preview.ts`

- [ ] **Step 1: Écrire `env.ts`**

```typescript
import { z } from "zod";

// Env typé, lecture paresseuse (ne parse pas au build). MEDIA_* = backend pilote.
const envSchema = z.object({
  APP_URL: z.string().url(),
  AUTH_URL: z.string().url().default("https://auth.contentos.ch"),
  APP_ENV: z.string().optional(),
  // URL interne du backend media sur le réseau lab (injectée par deploy.sh).
  MEDIA_INTERNAL_URL: z.string().url(),
  // Service-key partagée avec media (= MEDIA_ENGINE_SERVICE_KEY côté media).
  MEDIA_SERVICE_KEY: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;
let _env: Env | null = null;
function read(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}
export const env = new Proxy({} as Env, {
  get(_t, prop) {
    return (read() as unknown as Record<string | symbol, unknown>)[prop];
  },
}) as Env;
```

- [ ] **Step 2: Écrire `auth/preview.ts`** (copie media, sans changement)

```typescript
// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod";
}
export const isPreview = isPreviewEnv(process.env.APP_ENV);
export const PREVIEW_USER_ID = "preview-user";
```

- [ ] **Step 3: Commit**

```bash
git add projects/mcp/src/lib/env.ts projects/mcp/src/lib/auth/preview.ts
git commit -m "mcp: env typé (MEDIA_INTERNAL_URL/SERVICE_KEY) + preview"
```

### Task B3 : Registre de backends + client interne — TDD

**Files:**
- Create: `projects/mcp/src/lib/backends.ts`
- Create: `projects/mcp/src/lib/backend-client.ts`
- Test: `projects/mcp/test/backend-client.test.ts`

- [ ] **Step 1: Écrire le test d'abord** (fetch mocké : aucun réseau)

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { listTools, callTool } from "@/lib/backend-client";

const backend = { prefix: "media", baseUrl: "https://media.internal", serviceKey: "k" };

afterEach(() => { vi.restoreAllMocks(); });

describe("listTools", () => {
  it("appelle GET /internal/tools avec la service-key et renvoie les tools", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tools: [{ name: "generate_image", description: "d", inputSchema: { type: "object" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const tools = await listTools(backend);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("generate_image");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://media.internal/internal/tools");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("propage l'échec en lançant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(listTools(backend)).rejects.toThrow();
  });
});

describe("callTool", () => {
  it("POST /internal/tools/:name avec {userId,args} et renvoie result", async () => {
    const result = { content: [{ type: "text", text: "{}" }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callTool(backend, "generate_image", "u1", { prompt: "x" });
    expect(out).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://media.internal/internal/tools/generate_image");
    expect(JSON.parse(init.body as string)).toEqual({ userId: "u1", args: { prompt: "x" } });
  });

  it("mappe une erreur backend en résultat isError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Image introuvable: x" }), { status: 404 })));
    const out = await callTool(backend, "edit_image", "u1", { image_id: "x" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain("Image introuvable");
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `cd projects/mcp && npx vitest run test/backend-client.test.ts`
Expected: FAIL — modules inexistants.

- [ ] **Step 3: Écrire `backends.ts`**

```typescript
import { env } from "./env";

export type Backend = { prefix: string; baseUrl: string; serviceKey: string };

// Registre statique (v1 = media seul). Ajouter cast/ressources = specs suivants.
export const backends: Backend[] = [
  { prefix: "media", baseUrl: env.MEDIA_INTERNAL_URL, serviceKey: env.MEDIA_SERVICE_KEY },
];
```

- [ ] **Step 4: Écrire `backend-client.ts`**

```typescript
import type { Backend } from "./backends";

export type RemoteTool = { name: string; description: string; inputSchema: Record<string, unknown> };
export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

// Catalogue d'un backend via son contrat interne.
export async function listTools(backend: Backend): Promise<RemoteTool[]> {
  const res = await fetch(`${backend.baseUrl}/internal/tools`, {
    headers: { Authorization: `Bearer ${backend.serviceKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend ${backend.prefix} listTools ${res.status}`);
  const body = (await res.json()) as { tools: RemoteTool[] };
  return body.tools;
}

// Exécute un tool d'un backend. Une erreur HTTP du backend (4xx/5xx) est
// convertie en résultat MCP isError (dégradation gracieuse, pas un crash).
export async function callTool(
  backend: Backend,
  name: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const res = await fetch(`${backend.baseUrl}/internal/tools/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${backend.serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ userId, args }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { result?: ToolResult; error?: string };
  if (!res.ok || !body.result) {
    const message = body.error ?? `Backend ${backend.prefix} erreur ${res.status}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
  return body.result;
}
```

- [ ] **Step 5: Lancer, vérifier le passage**

Run: `cd projects/mcp && npx vitest run test/backend-client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add projects/mcp/src/lib/backends.ts projects/mcp/src/lib/backend-client.ts projects/mcp/test/backend-client.test.ts
git commit -m "mcp: registre backends + client interne (listTools/callTool) + tests"
```

### Task B4 : Auth de la passerelle (verifyMcpToken)

**Files:**
- Create: `projects/mcp/src/lib/mcp/auth.ts`

- [ ] **Step 1: Écrire `auth.ts`** (resource server : valide le bearer via auth.contentos.ch ; preview court-circuité)

```typescript
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { env } from "@/lib/env";
import { isPreview, PREVIEW_USER_ID } from "@/lib/auth/preview";

export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  if (isPreview) {
    return { token: "preview", clientId: "preview", scopes: [], extra: { userId: PREVIEW_USER_ID } };
  }
  const authz = req.headers.get("authorization");
  if (!authz) return undefined;
  const res = await fetch(`${env.AUTH_URL}/api/auth/mcp/get-session`, {
    headers: { authorization: authz },
    cache: "no-store",
  });
  if (!res.ok) return undefined;
  const session = await res.json();
  if (!session?.userId) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? "mcp-gateway",
    scopes: typeof session.scopes === "string" ? session.scopes.split(" ").filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}

export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") throw new Error("userId manquant dans le token");
  return userId;
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/mcp/src/lib/mcp/auth.ts
git commit -m "mcp: verifyMcpToken (resource server vers auth.contentos.ch)"
```

### Task B5 : Handlers de fédération `tools/list` + `tools/call` — TDD

**Files:**
- Create: `projects/mcp/src/lib/mcp/gateway.ts`
- Test: `projects/mcp/test/gateway.test.ts`

Le cœur : on pose les handlers **bas-niveau** sur le serveur SDK pour relayer les JSON Schemas des backends sans round-trip Zod. `tools/list` agrège+préfixe (dégradation si backend down) ; `tools/call` dé-préfixe et route.

- [ ] **Step 1: Écrire le test d'abord** (on teste les fonctions pures d'agrégation/routage, backend-client mocké)

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { aggregateToolList, routeToolCall } from "@/lib/mcp/gateway";
import * as client from "@/lib/backend-client";

const backends = [{ prefix: "media", baseUrl: "https://media.internal", serviceKey: "k" }];

afterEach(() => vi.restoreAllMocks());

describe("aggregateToolList", () => {
  it("préfixe les noms par backend", async () => {
    vi.spyOn(client, "listTools").mockResolvedValue([
      { name: "generate_image", description: "d", inputSchema: { type: "object" } },
    ]);
    const tools = await aggregateToolList(backends);
    expect(tools.map((t) => t.name)).toEqual(["media_generate_image"]);
    expect(tools[0].inputSchema).toEqual({ type: "object" });
  });

  it("dégradation : un backend down est omis, pas d'exception", async () => {
    vi.spyOn(client, "listTools").mockRejectedValue(new Error("down"));
    const tools = await aggregateToolList(backends);
    expect(tools).toEqual([]);
  });
});

describe("routeToolCall", () => {
  it("dé-préfixe et appelle le bon backend", async () => {
    const spy = vi.spyOn(client, "callTool").mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const out = await routeToolCall(backends, "media_generate_image", "u1", { prompt: "x" });
    expect(spy).toHaveBeenCalledWith(backends[0], "generate_image", "u1", { prompt: "x" });
    expect(out.content[0].text).toBe("ok");
  });

  it("nom sans backend connu → résultat isError", async () => {
    const out = await routeToolCall(backends, "inconnu_tool", "u1", {});
    expect(out.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `cd projects/mcp && npx vitest run test/gateway.test.ts`
Expected: FAIL — `gateway.ts` inexistant.

- [ ] **Step 3: Écrire `gateway.ts`**

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Backend } from "@/lib/backends";
import { backends as defaultBackends } from "@/lib/backends";
import { listTools, callTool, type RemoteTool, type ToolResult } from "@/lib/backend-client";
import { userIdFrom } from "./auth";

type NamespacedTool = RemoteTool & { name: string };

// Agrège les catalogues, préfixe `<prefix>_`. Un backend injoignable est omis (log + skip).
export async function aggregateToolList(backends: Backend[]): Promise<NamespacedTool[]> {
  const lists = await Promise.all(
    backends.map(async (b) => {
      try {
        const tools = await listTools(b);
        return tools.map((t) => ({ ...t, name: `${b.prefix}_${t.name}` }));
      } catch (e) {
        console.error(`[gateway] backend ${b.prefix} indisponible:`, e instanceof Error ? e.message : e);
        return [];
      }
    }),
  );
  return lists.flat();
}

// Dé-préfixe `<prefix>_<tool>` et route vers le backend. Nom inconnu → isError.
export async function routeToolCall(
  backends: Backend[],
  namespaced: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const backend = backends.find((b) => namespaced.startsWith(`${b.prefix}_`));
  if (!backend) {
    return { content: [{ type: "text", text: `Tool inconnu: ${namespaced}` }], isError: true };
  }
  const toolName = namespaced.slice(backend.prefix.length + 1);
  return callTool(backend, toolName, userId, args);
}

// Pose les handlers bas-niveau sur le serveur SDK (pas de registerTool : on relaie
// les JSON Schemas des backends tels quels).
export function registerGateway(server: McpServer, backends: Backend[] = defaultBackends): void {
  const low = server.server;
  low.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: await aggregateToolList(backends) };
  });
  low.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const userId = userIdFrom(extra as { authInfo?: import("@modelcontextprotocol/sdk/server/auth/types.js").AuthInfo });
    const { name, arguments: args } = request.params;
    return routeToolCall(backends, name, userId, (args ?? {}) as Record<string, unknown>);
  });
}
```

- [ ] **Step 4: Lancer, vérifier le passage**

Run: `cd projects/mcp && npx vitest run test/gateway.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/mcp/src/lib/mcp/gateway.ts projects/mcp/test/gateway.test.ts
git commit -m "mcp: handlers de fédération tools/list + tools/call (namespacing, dégradation) + tests"
```

### Task B6 : Route MCP + porte OAuth + .well-known + middleware

**Files:**
- Create: `projects/mcp/src/app/api/mcp/route.ts`
- Create: `projects/mcp/src/app/.well-known/oauth-protected-resource/route.ts`
- Create: `projects/mcp/src/app/.well-known/oauth-authorization-server/route.ts`
- Create: `projects/mcp/src/middleware.ts`

- [ ] **Step 1: Écrire la route MCP**

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerGateway } from "@/lib/mcp/gateway";

const base = createMcpHandler(
  (server) => registerGateway(server),
  { serverInfo: { name: "contentos", version: "1" }, capabilities: { tools: {} } },
  { basePath: "/api" },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 2: Écrire `.well-known/oauth-protected-resource/route.ts`**

```typescript
import { env } from "@/lib/env";

export function GET(): Response {
  return Response.json({
    resource: env.APP_URL,
    authorization_servers: [env.AUTH_URL],
    bearer_methods_supported: ["header"],
  });
}
```

- [ ] **Step 3: Écrire `.well-known/oauth-authorization-server/route.ts`**

```typescript
import { env } from "@/lib/env";

export function GET(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${env.AUTH_URL}/.well-known/oauth-authorization-server` },
  });
}
```

- [ ] **Step 4: Écrire `middleware.ts`** (la passerelle n'a pas d'UI ; laisse passer MCP + découverte + healthz)

```typescript
import { type NextRequest, NextResponse } from "next/server";

// Tout est public au sens cookie : l'API MCP s'auth en Bearer (withMcpAuth),
// la découverte OAuth est publique, healthz aussi. Pas de pages protégées.
export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/mcp|\\.well-known|healthz|_next|favicon).*)"],
};
```

- [ ] **Step 5: Typecheck**

Run: `cd projects/mcp && npx tsc --noEmit`
Expected: pas d'erreur. (Si `capabilities` n'est pas accepté à cet emplacement par la version de `mcp-handler`, le déplacer dans l'objet d'options approprié — vérifier le type exporté ; l'objectif est de déclarer la capability `tools`.)

- [ ] **Step 6: Commit**

```bash
git add projects/mcp/src/app/api/mcp/route.ts projects/mcp/src/app/.well-known projects/mcp/src/middleware.ts
git commit -m "mcp: route MCP (OAuth à la passerelle) + .well-known + middleware"
```

### Task B7 : Build + suite de tests de la passerelle

**Files:** (vérification)

- [ ] **Step 1: Lancer toute la suite de la passerelle**

Run: `cd projects/mcp && npm test`
Expected: PASS (backend-client + gateway).

- [ ] **Step 2: Vérifier que le build Next passe** (sans backend joignable : env factices)

Run: `cd projects/mcp && APP_URL=https://mcp.contentos.ch MEDIA_INTERNAL_URL=https://media.internal MEDIA_SERVICE_KEY=x npm run build`
Expected: build standalone OK (la lecture d'env est paresseuse ; aucun fetch au build).

- [ ] **Step 3: Commit** (rien si vert ; sinon corriger)

### Task B8 : Documentation projet + CLAUDE.md

**Files:**
- Modify: `projects/mcp/CLAUDE.md`

- [ ] **Step 1: Réécrire `projects/mcp/CLAUDE.md`** pour décrire l'état cible (instantané, pas d'historique)

```markdown
# mcp — passerelle MCP centrale

Serveur MCP **unique et public** de la suite contentos (`mcp.contentos.ch`). Façade thin,
**sans base** : valide le Bearer OAuth (auth.contentos.ch), récupère le catalogue des backends
internes et **relaie** les appels en préfixant les noms (`media_generate_image`…).

## Repères

- `src/app/api/mcp/route.ts` — porte MCP : `createMcpHandler` + `withMcpAuth`. Seule ressource
  protégée OAuth de la suite (`resource = APP_URL`).
- `src/lib/mcp/gateway.ts` — handlers bas-niveau `tools/list` (agrégation + namespacing +
  dégradation) et `tools/call` (dé-préfixe + route).
- `src/lib/backends.ts` — registre **statique** des backends ; `src/lib/backend-client.ts` parle
  leur contrat interne (`GET /internal/tools`, `POST /internal/tools/:name`, service-key).
- `.well-known/*` — découverte OAuth (délègue à auth.contentos.ch).

## Backends

Un backend expose `GET /internal/tools` (schémas JSON) et `POST /internal/tools/:name`
(`{userId,args}`), protégés par une service-key. La passerelle transmet le `userId` résolu ;
le backend applique son propre scoping. Variables : `MEDIA_INTERNAL_URL`, `MEDIA_SERVICE_KEY`.

## Dev / déploiement

`npm test` (vitest, fetch mocké, sans réseau). En attendant le palier d'intégration
`preview.contentos.ch`, la passerelle pointe vers les backends **prod** (cf.
`docs/decisions/0003-passerelle-mcp-centrale.md`). `git push` → preview ; PR mergée → prod.
Jamais de commit sur `main`.
```

- [ ] **Step 2: Commit**

```bash
git add projects/mcp/CLAUDE.md
git commit -m "mcp: CLAUDE.md de la passerelle"
```

---

## Hors plan (à NE PAS faire ici — specs/déploiement suivants)

- **Secrets & URL interne réelle :** créer `MEDIA_SERVICE_KEY` (= `MEDIA_ENGINE_SERVICE_KEY`) et
  `MEDIA_INTERNAL_URL` dans le store de secrets, résoudre le hostname/port du conteneur `media`
  sur le réseau lab, et faire pointer la passerelle vers `media` **prod** (pas d'intégration
  encore). Tâche de déploiement, traitée à part lors de la mise en service.
- **Tests DB de `media` :** la suite repository/store de `media` exige Postgres ; elle est
  vérifiée par la **CI** (gate unique, remote-first), pas en local sur ce checkout.
- **cast / ressources / plomberie starter :** specs séparés (cf. ADR-0003).

## Vérification finale avant PR

- [ ] `cd projects/mcp && npm test` vert.
- [ ] `cd projects/mcp && APP_URL=… MEDIA_INTERNAL_URL=… MEDIA_SERVICE_KEY=x npm run build` vert.
- [ ] `cd projects/media && npx tsc --noEmit` vert + tests DB-free verts (A9).
- [ ] `cd projects/media && grep -rn "mcp-handler\|withMcpAuth\|imageResult" src/ test/` → vide.
- [ ] Ouvrir la PR ; la CI build/test des deux projets est le gate réel.
