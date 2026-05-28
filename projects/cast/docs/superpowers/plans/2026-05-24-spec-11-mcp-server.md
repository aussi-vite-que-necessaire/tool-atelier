# Spec 11 — Serveur MCP (local, token) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serveur MCP sur `/api/mcp` (Streamable HTTP) exposant idées, posts, config, images, publication ; auth par token Bearer ; pilotable depuis Claude Code en local.

**Architecture (vérifiée par spike) :** `mcp-handler` v1.1.0 + `@modelcontextprotocol/sdk` v1.26 (zod 4 OK). Route `src/app/api/mcp/route.ts` : `withMcpAuth(createMcpHandler(init, { serverInfo }, { basePath: '/api' }), verifyToken, { required: true })`. `verifyToken` hache le Bearer → ligne `api_tokens` → `AuthInfo` avec `extra.userId`. Les tools lisent `extra.authInfo.extra.userId`. Middleware app à exclure pour `/api/mcp`.

**Tech Stack:** mcp-handler, @modelcontextprotocol/sdk, zod 4, BullMQ (await job), Drizzle, Vitest.

> Dépendances déjà installées : `mcp-handler`, `@modelcontextprotocol/sdk`. Middleware déjà patché (`/api/mcp` exclu). Route spike en place — à remplacer par la vraie au fil des tâches.

---

## Task 1 : Table `api_tokens` + token.ts + repo

**Files:**
- Create: `src/lib/db/schemas/api-tokens.ts`, `src/lib/db/repositories/api-tokens.ts`, `src/lib/mcp/token.ts`
- Modify: `src/lib/db/schema.ts` (export), `test/setup-integration.ts` (cleanup)
- Test: `test/unit/mcp-token.test.ts`
- Migration: `npm run db:generate`

- [ ] **Step 1 : Schéma**

```ts
// src/lib/db/schemas/api-tokens.ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
  },
  (t) => [index('api_tokens_user_id_idx').on(t.userId)],
);

export type ApiToken = typeof apiTokens.$inferSelect;
```

Ajouter `export * from './schemas/api-tokens';` dans `src/lib/db/schema.ts`.

- [ ] **Step 2 : token.ts (test d'abord)**

```ts
// test/unit/mcp-token.test.ts
import { describe, expect, test } from 'vitest';
import { generateToken, hashToken } from '@/lib/mcp/token';

describe('mcp token', () => {
  test('generateToken renvoie un clair + son hash, hash déterministe', () => {
    const { token, hash } = generateToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(token);
  });
  test('hash différent pour token différent', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
```

```ts
// src/lib/mcp/token.ts
import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function generateToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}
```

- [ ] **Step 3 : Repo**

```ts
// src/lib/db/repositories/api-tokens.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type ApiToken, apiTokens } from '../schema';

export async function createApiToken(
  userId: string,
  name: string,
  tokenHash: string,
): Promise<ApiToken> {
  const [row] = await db
    .insert(apiTokens)
    .values({ id: createId(), userId, name, tokenHash })
    .returning();
  return row!;
}

export async function findUserIdByTokenHash(tokenHash: string): Promise<string | undefined> {
  const rows = await db
    .select({ userId: apiTokens.userId, id: apiTokens.id })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);
  if (!rows[0]) return undefined;
  await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, rows[0].id));
  return rows[0].userId;
}

export async function listApiTokens(userId: string): Promise<ApiToken[]> {
  return db.select().from(apiTokens).where(eq(apiTokens.userId, userId));
}

export async function deleteApiToken(userId: string, id: string): Promise<void> {
  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}
```

Dans `test/setup-integration.ts` : importer `apiTokens` et ajouter `await db.delete(apiTokens);` avant la suppression de `user`.

- [ ] **Step 4 : Migration + tests**

Run: `npm run db:generate` puis appliquer : `npm run db:migrate` (dev) et `npm run db:test:prepare`.
Run: `npm run test:unit -- mcp-token`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/db/schemas/api-tokens.ts src/lib/db/repositories/api-tokens.ts src/lib/mcp/token.ts src/lib/db/schema.ts test/setup-integration.ts test/unit/mcp-token.test.ts drizzle/
git commit -m "🤖 feat(spec-11): table api_tokens + token Bearer (hash/génération)"
```

---

## Task 2 : await-job helper + auth verify + serveur MCP (route réelle)

**Files:**
- Create: `src/lib/queue/await-job.ts`, `src/lib/mcp/auth.ts`, `src/lib/mcp/server.ts`
- Modify: `src/app/api/mcp/route.ts` (remplace le spike)

- [ ] **Step 1 : await-job helper**

```ts
// src/lib/queue/await-job.ts
import { QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';
import { queueRegistry } from './registry';

export async function awaitJobResult<T>(
  queueName: string,
  jobId: string,
  timeoutMs = 60_000,
): Promise<T> {
  const queue = queueRegistry[queueName];
  if (!queue) throw new Error(`queue ${queueName} inconnue`);
  const job = await queue.getJob(jobId);
  if (!job) throw new Error(`job ${jobId} introuvable`);
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const events = new QueueEvents(queueName, { connection });
  try {
    await events.waitUntilReady();
    return (await job.waitUntilFinished(events, timeoutMs)) as T;
  } finally {
    await events.close();
    await connection.quit();
  }
}
```

- [ ] **Step 2 : auth verify**

```ts
// src/lib/mcp/auth.ts
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { findUserIdByTokenHash } from '@/lib/db/repositories/api-tokens';
import { hashToken } from './token';

export async function verifyMcpToken(
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  const userId = await findUserIdByTokenHash(hashToken(bearer));
  if (!userId) return undefined;
  return { token: bearer, clientId: 'content-os-mcp', scopes: [], extra: { userId } };
}

export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('userId manquant dans le token');
  return userId;
}
```

- [ ] **Step 3 : serveur MCP (registre des tools)**

```ts
// src/lib/mcp/server.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerIdeaTools } from './tools/ideas';
import { registerPostTools } from './tools/posts';
import { registerConfigTools } from './tools/config';
import { registerMediaTools } from './tools/media';
import { registerPublishingTools } from './tools/publishing';

export function registerAllTools(server: McpServer): void {
  registerIdeaTools(server);
  registerPostTools(server);
  registerConfigTools(server);
  registerMediaTools(server);
  registerPublishingTools(server);
}
```

(Les `registerXTools` sont créés dans les tâches suivantes ; pour cette tâche, créer des stubs vides qui seront remplis, ou commencer par `ideas` en Task 3 et n'enregistrer que ce qui existe.) Pour avancer proprement : en Task 2, n'enregistrer que `registerIdeaTools` après l'avoir créé en Task 3 — ou créer un helper d'enregistrement commun maintenant et brancher au fur et à mesure.

- [ ] **Step 4 : Route réelle**

```ts
// src/app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp/auth';
import { registerAllTools } from '@/lib/mcp/server';

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: 'content-os', version: '1' } },
  { basePath: '/api' },
);

const handler = withMcpAuth(base, verifyMcpToken, { required: true });

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 5 : tsc + smoke**

Run: `npx tsc --noEmit` (clean) puis smoke manuel : créer un token (Task 7) OU temporairement insérer une ligne, `curl` initialize avec/ sans Bearer → 401 / init result.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/queue/await-job.ts src/lib/mcp/auth.ts src/lib/mcp/server.ts src/app/api/mcp/route.ts
git commit -m "🤖 feat(spec-11): route MCP + auth Bearer (api_tokens) + await-job"
```

> Note d'ordre : créer `tools/ideas.ts` (Task 3) avant que `registerAllTools` ne le référence, ou commenter les imports non encore créés. Préférer : implémenter Task 3 juste après l'infra et brancher les `registerXTools` au fur et à mesure.

---

## Task 3 : Tools Idées + Posts (dont generate_post async)

**Files:**
- Create: `src/lib/mcp/tools/ideas.ts`, `src/lib/mcp/tools/posts.ts`
- Test: `test/integration/mcp-tools-content.test.ts`

**Pattern d'un tool** (à appliquer partout) :

```ts
server.registerTool(
  'create_idea',
  { title: 'Créer une idée', description: '…', inputSchema: { idea: z.string(), brief: z.string().optional() } },
  async (input, extra) => {
    const userId = userIdFrom(extra);
    const created = await createIdea(userId, { idea: input.idea, brief: input.brief });
    return { content: [{ type: 'text', text: JSON.stringify(created) }] };
  },
);
```

- [ ] **Step 1 : `tools/ideas.ts`** — `registerIdeaTools(server)` enregistrant `list_ideas`, `create_idea {idea, brief?}`, `update_idea {id, idea?, brief?}`, `delete_idea {id}`, via les repos `ideas`. Renvoient le résultat en `JSON.stringify`.

- [ ] **Step 2 : `tools/posts.ts`** — `registerPostTools(server)` :
  - `list_posts`, `get_post {id}`, `edit_post {id, content}` (via `updatePost`), `set_post_status {id, status}` (via `updatePost`), `delete_post {id}` ;
  - `generate_post {ideaId, writingTemplateId}` **async** : génère un `jobKey` (`crypto.randomUUID()`), `enqueueGeneratePost({ userId, ideaId, writingTemplateId, jobKey })`, `await awaitJobResult<{ postId: string }>('generate-post', jobKey)`, puis `getPost(userId, postId)` → renvoie le post. Pré-checks repris de `enqueueGeneratePostCore` (idée + brief + template existants), erreurs renvoyées en texte.

- [ ] **Step 3 : Brancher** `registerIdeaTools` + `registerPostTools` dans `server.ts`.

- [ ] **Step 4 : Tests d'intégration (handlers via fonctions internes)**

Extraire la logique de chaque tool dans une fonction exportée `(userId, input, deps?) => result` que le `registerTool` appelle, pour la tester sans transport. Tests : `create_idea`+`list_ideas`, `edit_post`+`set_post_status` (créer idea+post au préalable), `get_post`. Pour `generate_post`, injecter un `run` factice renvoyant `{ postId }` d'un post pré-créé et vérifier que le tool renvoie ce post.

```ts
// exemple de structure testable
export async function createIdeaTool(userId: string, input: { idea: string; brief?: string }) {
  return createIdea(userId, input);
}
```

Run: `npm run test:integration -- mcp-tools-content`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/mcp/tools/ideas.ts src/lib/mcp/tools/posts.ts src/lib/mcp/server.ts test/integration/mcp-tools-content.test.ts
git commit -m "🤖 feat(spec-11): tools MCP idées + posts (dont generate_post async)"
```

---

## Task 4 : Tools Config (lecture + écriture)

**Files:**
- Create: `src/lib/mcp/tools/config.ts`
- Test: étendre `test/integration/mcp-tools-content.test.ts` (ou un nouveau fichier)

- [ ] **Step 1 : `tools/config.ts`** — `registerConfigTools(server)` :
  - Voix : `get_voice`, `set_voice {content}` (via `upsertVoice`/`updateVoice` — vérifier la signature du repo `voice`).
  - Briefing visuel : `get_visual_briefing`, `set_visual_briefing {content}` (repo `visual-briefing`).
  - Settings : `get_settings`.
  - Templates d'écriture : `list_writing_templates`, `create_writing_template {name, slug, platform, structure, writingRules?}`, `update_writing_template {id, ...}`, `delete_writing_template {id}`.
  - Lecture seule : `list_visual_templates`, `list_visual_styles`.
  > Vérifier les signatures exactes des repos `voice`, `visual-briefing`, `settings`, `writing-templates` avant d'écrire (elles existent déjà, cf. Specs 3-5).

- [ ] **Step 2 : Brancher** dans `server.ts`.

- [ ] **Step 3 : Tests** : `set_voice` puis `get_voice` (round-trip), `create_writing_template` puis `list_writing_templates`.

Run: `npm run test:integration -- mcp-tools`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/mcp/tools/config.ts src/lib/mcp/server.ts test/integration/
git commit -m "🤖 feat(spec-11): tools MCP config éditoriale (lecture + écriture)"
```

---

## Task 5 : Tools Images / médias (async)

**Files:**
- Create: `src/lib/mcp/tools/media.ts`
- Test: étendre les tests d'intégration MCP

- [ ] **Step 1 : `tools/media.ts`** — `registerMediaTools(server)` :
  - `list_gallery_images` (via `listStandaloneImages` + `signedUrl`).
  - `generate_image {prompt, aspectRatio?, styleId?}` **async** : `jobKey`, `enqueueGenerateImage({ userId, prompt, aspectRatio, styleId, jobKey })`, `await awaitJobResult<{ mediaId; signedUrl; width; height }>('generate-image', jobKey)` → renvoie le média.
  - `edit_image {sourceMediaId, prompt}` **async** : idem avec `sourceMediaId`.
  - `render_visual {templateId, vars, postId?}` **async** : `enqueueRenderVisual({ ..., mode: 'final', jobKey })`, attendre `{ mediaId, … }`.
  - `attach_media_to_post {postId, mediaId}` (via `attachExistingMediaCore`), `detach_media {postId}` (via `updatePost mediaId:null`).
  > Reprendre les pré-checks/validations existants (`media-actions.ts`, `media-actions-core.ts`).

- [ ] **Step 2 : Brancher** dans `server.ts`.

- [ ] **Step 3 : Tests** : `attach_media_to_post`/`detach_media` (sync, créer media+post). Pour les async, injecter un `run` factice renvoyant un `{ mediaId }` pré-créé et vérifier le format de sortie.

Run: `npm run test:integration -- mcp-tools`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/mcp/tools/media.ts src/lib/mcp/server.ts test/integration/
git commit -m "🤖 feat(spec-11): tools MCP images (génération/édition/rendu async, attache)"
```

---

## Task 6 : Tools LinkedIn / publication

**Files:**
- Create: `src/lib/mcp/tools/publishing.ts`
- Test: étendre les tests d'intégration MCP

- [ ] **Step 1 : `tools/publishing.ts`** — `registerPublishingTools(server)` :
  - `get_linkedin_connection` : `getSocialAccount(userId, 'linkedin')` → `{ connected, displayName, runwayDays }` ou `{ connected: false }` (réutiliser `runwayDays`).
  - `publish_post_now {postId}` **async** : `publishNow(userId, postId, enqueue)` où `enqueue` enfile via `enqueuePublishLinkedin`, puis `await awaitJobResult('publish-linkedin', publicationId)`, puis recharger la publication → renvoyer `{ status, externalUrl }`. (Le statut final est `published` ou `failed` ; renvoyer l'info, et le message d'erreur si `failed`.)
  - `schedule_post {postId, whenIso}` : `schedulePublication(userId, postId, new Date(whenIso), tz='UTC', enqueue)` → renvoie la publication (statut `scheduled`).
  - `cancel_scheduled {publicationId}` : `cancelPublication(userId, publicationId, removePublishLinkedin)`.
  - `list_publications` : `listPublications(userId)`.

- [ ] **Step 2 : Brancher** dans `server.ts`.

- [ ] **Step 3 : Tests** : `get_linkedin_connection` (avec/sans compte), `schedule_post`+`cancel_scheduled` (enqueue/dequeue mockés via injection), `list_publications`. `publish_post_now` : injecter un `run` factice marquant la publication `published` puis vérifier le retour.

Run: `npm run test:integration -- mcp-tools`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/mcp/tools/publishing.ts src/lib/mcp/server.ts test/integration/
git commit -m "🤖 feat(spec-11): tools MCP publication LinkedIn (statut/publier/planifier/annuler)"
```

---

## Task 7 : Script `mcp:token` + doc + vérification manuelle

**Files:**
- Create: `scripts/mcp-token.ts`
- Modify: `package.json` (script), `.env.example` (doc)

- [ ] **Step 1 : Script**

```ts
// scripts/mcp-token.ts
#!/usr/bin/env tsx
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { createApiToken } from '@/lib/db/repositories/api-tokens';
import { generateToken } from '@/lib/mcp/token';
import { user } from '@/lib/db/schema';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run mcp:token -- <email>');
    process.exit(1);
  }
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  const userId = rows[0]?.id;
  if (!userId) {
    console.error(`Aucun user pour "${email}". Connecte-toi d'abord.`);
    process.exit(1);
  }
  const { token, hash } = generateToken();
  await createApiToken(userId, `cli ${new Date().toISOString()}`, hash);
  console.log('\nToken (à copier maintenant, non ré-affiché) :\n');
  console.log(token);
  console.log('\nConnexion Claude Code :');
  console.log(
    `  claude mcp add --transport http content-os http://localhost:3000/api/mcp --header "Authorization: Bearer ${token}"\n`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Ajouter au `package.json` : `"mcp:token": "tsx --env-file-if-exists=.env scripts/mcp-token.ts"`.

- [ ] **Step 2 : Doc `.env.example`** — bloc commentaire :

```
# MCP (pilotage par agent IA en local) :
#   npm run mcp:token -- <ton-email>   # génère un token + la commande claude mcp add
```

- [ ] **Step 3 : Vérification manuelle (réelle)**

Démarrer `npm run dev:all`, générer un token, `claude mcp add …`, puis depuis Claude Code lister les tools et appeler `list_ideas`, `create_idea`, `generate_post`. Optionnel : `npx @modelcontextprotocol/inspector`. Documenter le résultat (non automatisé).

- [ ] **Step 4 : Commit**

```bash
git add scripts/mcp-token.ts package.json .env.example
git commit -m "🤖 feat(spec-11): script mcp:token + doc connexion Claude Code"
```

---

## Task 8 : Validation finale + PR

- [ ] **Step 1 : Suite complète** — `npm run db:test:prepare && npm test` → tous verts.
- [ ] **Step 2 : Lint + format + tsc** — `npx biome check --write . && npm run lint && npx tsc --noEmit` → clean.
- [ ] **Step 3 : E2E complète** — `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"; CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e` → inchangé/verts (le MCP n'a pas d'E2E Playwright).
- [ ] **Step 4 : Push + PR (ne pas merger)** — `git push -u origin spec-11/mcp-server` ; `gh pr create` décrivant les tools, l'auth token, et la connexion Claude Code.
- [ ] **Step 5 : Surveiller CI vert**, puis rendre la main (l'utilisateur teste la connexion réelle depuis Claude Code).
```
