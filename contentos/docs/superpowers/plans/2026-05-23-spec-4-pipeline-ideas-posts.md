# Spec 4 (Pipeline ideas → posts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un user de capturer une idée (titre + brief) puis générer un post draft de manière asynchrone via la queue BullMQ `generate-post` (Claude Sonnet 4.6, `write + polish + lintEditorial`), avec UI `/ideas` (édition inline, polling), `/posts` (liste) et `/posts/[id]` (édition + toggle draft/validated).

**Architecture:** Migration additive `posts.generation_job_id` pour idempotency. Nouvelle queue BullMQ + worker `generate-post` qui lit `voice`/`idea`/`writing_template` en DB (payload minimal = IDs). Server Actions en pattern wrapper/core (cohérent Spec 2/3). UI : Server Components + Client Components shadcn, blur-to-save via Server Actions, polling `/api/jobs/[id]?queue=generate-post` toutes les 2s pour suivre la génération. Stub `CONTENT_OS_AI_STUB=1` côté worker pour les tests sans appel Anthropic.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM 0.45, Postgres 16, BullMQ 5, ioredis, Better-Auth 1.6, Vitest 4, Playwright, Tailwind v4, shadcn/ui (button/input/label/textarea/card/select/sonner déjà installés), `@paralleldrive/cuid2`, Zod 4, sonner, **nouveau : `@anthropic-ai/sdk`**.

**Repo cible:** `/Users/ManuAVQN/Code/content-os-v2/` (branche `main`).

**Spec de référence:** `docs/superpowers/specs/2026-05-23-spec-4-pipeline-ideas-posts-design.md`

---

## Phase 1 : Foundation

### Task 1: Helper `requireUserId` + dépendances + env

Pose les fondations utilisées par toutes les tasks suivantes : un helper auth réutilisable, l'install du SDK Anthropic, et les variables d'env nécessaires.

**Files:**
- Create: `src/lib/auth/session.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Modify: `package.json` (ajout dépendance)
- Refactor (optionnel): `src/app/(app)/settings/brand/actions.ts:11-13`

- [ ] **Step 1: Installer `@anthropic-ai/sdk`**

Run: `npm install @anthropic-ai/sdk`

Vérifier qu'il apparaît dans `package.json` sous `dependencies`. Pas de version pin agressive — laisser `^x.y.z`.

- [ ] **Step 2: Étendre `src/lib/env.ts`**

Remplacer le fichier par :

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CONTENT_OS_AI_STUB: z.enum(['0', '1']).default('0'),
});

export const env = envSchema.parse(process.env);
```

`ANTHROPIC_API_KEY` est `optional` parce que le worker peut tourner en stub (`CONTENT_OS_AI_STUB=1`). Le module `src/lib/ai/generate-post.ts` (Task 9) bombera explicitement si la clé manque et que le stub n'est pas activé.

- [ ] **Step 3: Mettre à jour `.env.example`**

Ajouter à la fin du fichier (créer le fichier si nécessaire — déjà présent vu `ls`) :

```
# Anthropic (texte). Laisse vide si tu utilises CONTENT_OS_AI_STUB=1 pour les tests.
ANTHROPIC_API_KEY=

# Worker stub : si "1", le worker generate-post n'appelle pas Claude
# et retourne un faux contenu. Utilisé en CI et tests E2E.
CONTENT_OS_AI_STUB=0
```

- [ ] **Step 4: Créer `src/lib/auth/session.ts`**

```ts
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './server';

/**
 * Récupère le userId de la session courante (Server Component / Server Action).
 * Redirige vers /signin si pas de session active.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');
  return session.user.id;
}

/**
 * Variante non-redirigeante. Retourne undefined si pas de session.
 * Utiliser dans les contextes où on veut gérer l'absence soi-même.
 */
export async function getUserId(): Promise<string | undefined> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id;
}
```

- [ ] **Step 5: Vérifier que le typecheck passe**

Run: `npx tsc --noEmit`

Attendu : 0 erreur. Si erreur sur `next/navigation` ou `next/headers`, c'est qu'un import est mauvais — vérifier la syntaxe.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/session.ts src/lib/env.ts .env.example package.json package-lock.json
git commit -m "$(cat <<'EOF'
🤖 feat(auth): helper requireUserId + dépendance @anthropic-ai/sdk

Pose les fondations Spec 4 : helper requireUserId() factorisé pour les
Server Actions/Components, installation du SDK Claude, variables env
ANTHROPIC_API_KEY et CONTENT_OS_AI_STUB (mode stub pour les tests).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration `posts.generation_job_id`

Ajoute la colonne d'idempotency au schema posts. La contrainte UNIQUE garantit qu'un même `jobKey` ne crée pas deux rows.

**Files:**
- Modify: `src/lib/db/schemas/posts.ts:18-21`
- Generate: `drizzle/000X_*.sql` (via drizzle-kit)
- Modify: `test/setup-integration.ts` (rien à changer normalement, mais vérifier)

- [ ] **Step 1: Ajouter la colonne dans le schema**

Remplacer le contenu de `src/lib/db/schemas/posts.ts` par :

```ts
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { ideas } from './ideas';
import { media } from './media';

export const postStatus = pgEnum('post_status', ['draft', 'validated']);

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ideaId: text('idea_id')
      .notNull()
      .references(() => ideas.id, { onDelete: 'cascade' }),
    writingTemplateId: text('writing_template_id'),
    mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
    generationJobId: text('generation_job_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('posts_user_id_idx').on(table.userId),
    index('posts_idea_id_idx').on(table.ideaId),
    index('posts_media_id_idx').on(table.mediaId),
  ],
);

export type Post = typeof posts.$inferSelect;
```

- [ ] **Step 2: Générer la migration**

Run: `npm run db:generate`

Attendu : un nouveau fichier `drizzle/000X_<random-slug>.sql` est créé. Lire son contenu pour vérifier qu'il contient bien :

```sql
ALTER TABLE "posts" ADD COLUMN "generation_job_id" text;
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_generation_job_id_unique" UNIQUE("generation_job_id");
```

Si autre chose apparaît, c'est qu'il y a eu de la dérive — investiguer.

- [ ] **Step 3: Appliquer la migration**

Run: `npm run db:migrate`

Attendu : message "No migrations to apply" si déjà à jour, sinon "Migrations applied".

- [ ] **Step 4: Smoke-check via Drizzle Studio (optionnel)**

Run: `npm run db:studio &`

Ouvrir `https://local.drizzle.studio`, naviguer vers la table `posts`, vérifier que la colonne `generation_job_id` (text, nullable, unique) est présente. Fermer le studio (`kill %1` ou Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schemas/posts.ts drizzle/
git commit -m "$(cat <<'EOF'
🤖 feat(db): posts.generation_job_id pour l'idempotency BullMQ

Colonne nullable + UNIQUE. Le worker generate-post stockera ici le
jobKey (UUID v4) à l'insertion. Une seconde tentative d'INSERT avec
le même jobKey (race condition double-delivery) violera la contrainte
et le worker rattrapera l'erreur pour retourner la row existante.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 : Repositories

### Task 3: Extensions repository `ideas` + tests

Tri par `updated_at DESC`, ajout `listPostsByIdea` et `countPostsByIdea` (cross-repo justifié par l'usage page `/ideas`).

**Files:**
- Modify: `src/lib/db/repositories/ideas.ts`
- Modify: `test/integration/ideas-repository.test.ts` (étendre — déjà existant)

- [ ] **Step 1: Refondre `src/lib/db/repositories/ideas.ts`**

Remplacer le fichier entier par :

```ts
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Idea, ideas, type Post, posts } from '../schema';

export type CreateIdeaInput = { idea: string; brief?: string };
export type UpdateIdeaPatch = Partial<{ idea: string; brief: string | null }>;

export async function createIdea(userId: string, data: CreateIdeaInput): Promise<Idea> {
  const id = createId();
  const [row] = await db
    .insert(ideas)
    .values({ id, userId, idea: data.idea, brief: data.brief ?? null })
    .returning();
  return row!;
}

export async function getIdea(userId: string, id: string): Promise<Idea | undefined> {
  const rows = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listIdeas(userId: string): Promise<Idea[]> {
  return db
    .select()
    .from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.updatedAt));
}

export async function updateIdea(
  userId: string,
  id: string,
  patch: UpdateIdeaPatch,
): Promise<Idea | undefined> {
  const rows = await db
    .update(ideas)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteIdea(userId: string, id: string): Promise<void> {
  await db.delete(ideas).where(and(eq(ideas.id, id), eq(ideas.userId, userId)));
}

export async function listPostsByIdea(userId: string, ideaId: string): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.ideaId, ideaId)))
    .orderBy(desc(posts.createdAt));
}

export async function countPostsByIdea(userId: string, ideaId: string): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.ideaId, ideaId)));
  return row?.c ?? 0;
}
```

- [ ] **Step 2: Lire le test ideas existant pour comprendre les helpers**

Run: `cat test/integration/ideas-repository.test.ts | head -60`

Identifier les imports et helpers utilisés (notamment comment un user est créé en setup). Suivre le même pattern dans les nouveaux tests.

- [ ] **Step 3: Ajouter les tests pour `listIdeas` order, `listPostsByIdea`, `countPostsByIdea`**

Dans `test/integration/ideas-repository.test.ts`, ajouter à la fin du `describe` principal (ou créer un nouveau `describe` "listPostsByIdea + countPostsByIdea") :

```ts
import { createPost } from '@/lib/db/repositories/posts';
// (et garder les imports existants)

describe('listIdeas ordering', () => {
  it('returns ideas sorted by updated_at DESC', async () => {
    const userId = await createTestUser();
    const a = await createIdea(userId, { idea: 'A' });
    await new Promise((r) => setTimeout(r, 10));
    const b = await createIdea(userId, { idea: 'B' });
    await new Promise((r) => setTimeout(r, 10));
    await updateIdea(userId, a.id, { idea: 'A bis' });

    const list = await listIdeas(userId);
    expect(list.map((i) => i.id)).toEqual([a.id, b.id]);
  });
});

describe('listPostsByIdea + countPostsByIdea', () => {
  it('lists posts of an idea sorted by created_at DESC, scoped by user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    const ideaB = await createIdea(userB, { idea: 'B' });

    const p1 = await createPost(userA, { ideaId: ideaA.id, content: 'first' });
    await new Promise((r) => setTimeout(r, 10));
    const p2 = await createPost(userA, { ideaId: ideaA.id, content: 'second' });
    await createPost(userB, { ideaId: ideaB.id, content: 'other' });

    const posts = await listPostsByIdea(userA, ideaA.id);
    expect(posts.map((p) => p.id)).toEqual([p2.id, p1.id]);

    const count = await countPostsByIdea(userA, ideaA.id);
    expect(count).toBe(2);
  });

  it('returns empty list and count 0 for an idea with no posts', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'lonely' });
    expect(await listPostsByIdea(userId, idea.id)).toEqual([]);
    expect(await countPostsByIdea(userId, idea.id)).toBe(0);
  });

  it('does not leak posts from other users on the same idea_id (impossible by FK, but defensive)', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    await createPost(userA, { ideaId: ideaA.id, content: 'a-post' });
    // userB ne peut pas voir les posts de userA sur ideaA
    const list = await listPostsByIdea(userB, ideaA.id);
    expect(list).toEqual([]);
  });
});
```

Si `createTestUser` n'existe pas, regarder `test/integration/helpers/` (vu via `ls`) pour le helper réel.

- [ ] **Step 4: Lancer les tests integration**

Run: `npm run test:integration -- ideas-repository`

Attendu : tous les nouveaux tests passent, aucune régression sur les existants.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/ideas.ts test/integration/ideas-repository.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): listIdeas DESC + listPostsByIdea + countPostsByIdea

Tri par updated_at pour la page /ideas (les édits récents remontent).
Cross-repo lookup posts-by-idea factorisé dans ideas.ts car c'est sa
page d'appel principale. Tests integration sur ordering, scoping
user_id, vide.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extensions repository `posts` + tests

Ajout `generationJobId` à `CreatePostInput`, tri DESC, lookup par jobKey (cross-tenant volontaire), join idea pour la page liste.

**Files:**
- Modify: `src/lib/db/repositories/posts.ts`
- Modify: `test/integration/posts-repository.test.ts`

- [ ] **Step 1: Refondre `src/lib/db/repositories/posts.ts`**

Remplacer le fichier entier par :

```ts
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Idea, ideas, type Post, posts } from '../schema';

export type CreatePostInput = {
  ideaId: string;
  content: string;
  writingTemplateId?: string | null;
  mediaId?: string | null;
  status?: 'draft' | 'validated';
  generationJobId?: string | null;
};

export type UpdatePostPatch = Partial<{
  content: string;
  status: 'draft' | 'validated';
  writingTemplateId: string | null;
  mediaId: string | null;
}>;

export type PostWithIdea = {
  post: Post;
  idea: Pick<Idea, 'id' | 'idea'>;
};

export async function createPost(userId: string, data: CreatePostInput): Promise<Post> {
  const id = createId();
  const [row] = await db
    .insert(posts)
    .values({
      id,
      userId,
      ideaId: data.ideaId,
      content: data.content,
      writingTemplateId: data.writingTemplateId ?? null,
      mediaId: data.mediaId ?? null,
      status: data.status ?? 'draft',
      generationJobId: data.generationJobId ?? null,
    })
    .returning();
  return row!;
}

export async function getPost(userId: string, id: string): Promise<Post | undefined> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPosts(userId: string): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.updatedAt));
}

/**
 * Pour la page /posts : join sur ideas pour afficher le titre de l'idée source.
 * Évite le N+1 d'un listPosts puis getIdea(post.ideaId) en boucle.
 */
export async function listPostsWithIdea(userId: string): Promise<PostWithIdea[]> {
  const rows = await db
    .select({
      post: posts,
      ideaId: ideas.id,
      ideaTitle: ideas.idea,
    })
    .from(posts)
    .leftJoin(ideas, eq(posts.ideaId, ideas.id))
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.updatedAt));
  return rows.map((r) => ({
    post: r.post,
    idea: { id: r.ideaId!, idea: r.ideaTitle! },
  }));
}

export async function updatePost(
  userId: string,
  id: string,
  patch: UpdatePostPatch,
): Promise<Post | undefined> {
  const rows = await db
    .update(posts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(posts.id, id), eq(posts.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePost(userId: string, id: string): Promise<void> {
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.userId, userId)));
}

/**
 * Lookup non-scopé par user_id : volontaire.
 * Utilisé EXCLUSIVEMENT par le worker generate-post pour rattraper une
 * double-delivery BullMQ via le jobKey (UUID v4 unique). Le worker n'a
 * pas de session, et le jobKey est un capability token interne.
 * Ne JAMAIS exposer ce lookup via une route HTTP ou une Server Action.
 */
export async function getPostByGenerationJobId(jobKey: string): Promise<Post | undefined> {
  const rows = await db
    .select()
    .from(posts)
    .where(eq(posts.generationJobId, jobKey))
    .limit(1);
  return rows[0];
}
```

- [ ] **Step 2: Étendre `test/integration/posts-repository.test.ts`**

Ajouter ces tests à la fin du fichier (avant la dernière accolade fermante du describe global) :

```ts
describe('listPosts ordering + generationJobId', () => {
  it('returns posts sorted by updated_at DESC', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'A' });
    const p1 = await createPost(userId, { ideaId: idea.id, content: 'first' });
    await new Promise((r) => setTimeout(r, 10));
    const p2 = await createPost(userId, { ideaId: idea.id, content: 'second' });
    await new Promise((r) => setTimeout(r, 10));
    await updatePost(userId, p1.id, { content: 'first updated' });

    const list = await listPosts(userId);
    expect(list.map((p) => p.id)).toEqual([p1.id, p2.id]);
  });

  it('createPost accepts generationJobId and enforces UNIQUE constraint', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'A' });
    const jobKey = crypto.randomUUID();

    await createPost(userId, { ideaId: idea.id, content: 'first', generationJobId: jobKey });
    await expect(
      createPost(userId, { ideaId: idea.id, content: 'dup', generationJobId: jobKey }),
    ).rejects.toThrow();
  });
});

describe('listPostsWithIdea', () => {
  it('joins idea title and scopes by user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'IdeeA' });
    const ideaB = await createIdea(userB, { idea: 'IdeeB' });
    await createPost(userA, { ideaId: ideaA.id, content: 'post-a' });
    await createPost(userB, { ideaId: ideaB.id, content: 'post-b' });

    const listA = await listPostsWithIdea(userA);
    expect(listA).toHaveLength(1);
    expect(listA[0]!.idea.idea).toBe('IdeeA');
    expect(listA[0]!.post.content).toBe('post-a');

    const listB = await listPostsWithIdea(userB);
    expect(listB).toHaveLength(1);
    expect(listB[0]!.idea.idea).toBe('IdeeB');
  });
});

describe('getPostByGenerationJobId', () => {
  it('returns the post regardless of user (worker lookup)', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'A' });
    const jobKey = crypto.randomUUID();
    const created = await createPost(userId, {
      ideaId: idea.id,
      content: 'c',
      generationJobId: jobKey,
    });

    const found = await getPostByGenerationJobId(jobKey);
    expect(found?.id).toBe(created.id);
  });

  it('returns undefined for unknown jobKey', async () => {
    const found = await getPostByGenerationJobId(crypto.randomUUID());
    expect(found).toBeUndefined();
  });
});
```

Ajouter `import { createIdea } from '@/lib/db/repositories/ideas';` en haut du fichier s'il n'est pas déjà importé.

- [ ] **Step 3: Lancer les tests**

Run: `npm run test:integration -- posts-repository`

Attendu : tous les nouveaux tests passent. Si `crypto.randomUUID()` n'est pas disponible, remplacer par `import { randomUUID } from 'node:crypto'` en haut du fichier.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/repositories/posts.ts test/integration/posts-repository.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): posts.generationJobId + listPostsWithIdea + jobKey lookup

CreatePostInput accepte generationJobId. listPosts trié DESC.
listPostsWithIdea fait un leftJoin sur ideas pour la page liste (évite
le N+1). getPostByGenerationJobId est volontairement non-scopé user_id
(usage worker uniquement, documenté). Tests integration sur ordering,
unique constraint, scoping cross-user pour le join, lookup jobKey.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Étendre la sentinelle tenant isolation

Vérifier qu'un user ne peut pas lire/écrire les ideas/posts d'un autre via les repositories (déjà partiellement couvert, on s'assure que les nouvelles fonctions sont incluses).

**Files:**
- Modify: `test/integration/tenant-isolation.test.ts`

- [ ] **Step 1: Lire la sentinelle existante**

Run: `cat test/integration/tenant-isolation.test.ts | head -80`

Identifier le pattern : itération sur les repositories, assertion "user A ne peut pas voir/modifier les rows de user B".

- [ ] **Step 2: Ajouter les couvertures pour les nouvelles fonctions**

Ajouter dans le `describe` "tenant isolation" un nouveau bloc :

```ts
describe('ideas/posts extensions Spec 4', () => {
  it('listPostsByIdea: user B does not see posts of user A on the same idea_id', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    await createPost(userA, { ideaId: ideaA.id, content: 'secret' });
    expect(await listPostsByIdea(userB, ideaA.id)).toEqual([]);
  });

  it('countPostsByIdea: user B sees 0 on user A idea even if posts exist', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    await createPost(userA, { ideaId: ideaA.id, content: 'one' });
    expect(await countPostsByIdea(userB, ideaA.id)).toBe(0);
  });

  it('listPostsWithIdea: only returns posts of the calling user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    const ideaB = await createIdea(userB, { idea: 'B' });
    await createPost(userA, { ideaId: ideaA.id, content: 'a' });
    await createPost(userB, { ideaId: ideaB.id, content: 'b' });

    const listA = await listPostsWithIdea(userA);
    expect(listA.map((r) => r.post.content)).toEqual(['a']);
    const listB = await listPostsWithIdea(userB);
    expect(listB.map((r) => r.post.content)).toEqual(['b']);
  });
});
```

Ajouter les imports en haut : `listPostsByIdea, countPostsByIdea` depuis `@/lib/db/repositories/ideas`, `listPostsWithIdea` depuis `@/lib/db/repositories/posts`.

- [ ] **Step 3: Lancer les tests**

Run: `npm run test:integration -- tenant-isolation`

Attendu : tous verts.

- [ ] **Step 4: Commit**

```bash
git add test/integration/tenant-isolation.test.ts
git commit -m "$(cat <<'EOF'
🤖 test(integration): sentinelle tenant pour ideas/posts Spec 4

Couvre listPostsByIdea, countPostsByIdea, listPostsWithIdea. Garantit
qu'un user B ne peut pas accéder aux posts d'un user A même en passant
un ideaId qui appartient à A.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 : Queue infrastructure

### Task 6: Queue `generate-post` + registry + enqueue

Pose la queue BullMQ et son enqueue function. Le registry permettra à `/api/jobs/[id]` d'interroger n'importe quelle queue.

**Files:**
- Modify: `src/lib/queue/client.ts`
- Modify: `src/lib/queue/enqueue.ts`
- Create: `src/lib/queue/registry.ts`

- [ ] **Step 1: Étendre `src/lib/queue/client.ts`**

Remplacer le fichier entier par :

```ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const dummyQueue = new Queue<{ message: string }, { ok: true; echoed: string }>('dummy', {
  connection: redisConnection,
});

export type GeneratePostJob = {
  userId: string;
  ideaId: string;
  writingTemplateId: string;
  jobKey: string;
};

export type GeneratePostResult = { postId: string };

export const generatePostQueue = new Queue<GeneratePostJob, GeneratePostResult>('generate-post', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
```

- [ ] **Step 2: Étendre `src/lib/queue/enqueue.ts`**

Remplacer le fichier entier par :

```ts
import { dummyQueue, type GeneratePostJob, generatePostQueue } from './client';

export async function enqueueDummy(message: string): Promise<string> {
  const job = await dummyQueue.add('echo', { message });
  return job.id!;
}

export async function enqueueGeneratePost(payload: GeneratePostJob): Promise<string> {
  const job = await generatePostQueue.add('write+polish', payload, {
    jobId: payload.jobKey,
  });
  return job.id!;
}
```

- [ ] **Step 3: Créer `src/lib/queue/registry.ts`**

```ts
import type { Queue } from 'bullmq';
import { dummyQueue, generatePostQueue } from './client';

export const queueRegistry: Record<string, Queue> = {
  dummy: dummyQueue,
  'generate-post': generatePostQueue,
};

export type QueueName = keyof typeof queueRegistry;
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `npx tsc --noEmit`

Attendu : 0 erreur. Si erreur dans `src/worker/index.ts` à cause de l'import de types, ne pas s'inquiéter — sera réglé en Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue/
git commit -m "$(cat <<'EOF'
🤖 feat(queue): queue generate-post + registry + enqueueGeneratePost

Nouvelle queue BullMQ generate-post avec retries 3x backoff exponentiel
1m base, removeOnComplete 24h/1000 jobs, removeOnFail 7j. Le jobId
BullMQ est forcé au jobKey UUID v4 fourni par l'appelant (dédup à
l'enqueue, idempotency DB côté worker). Registry pour /api/jobs/[id].

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Refactor `/api/jobs/[id]` généralisé

Aujourd'hui hardcodé sur `dummy`. Demain capable d'interroger n'importe quelle queue du registry via `?queue=`.

**Files:**
- Modify: `src/app/api/jobs/[id]/route.ts`
- Create: `src/app/api/jobs/[id]/__tests__/route.test.ts` (skip si pas de pattern existant pour tester les Route Handlers — on s'en remettra à l'E2E)

- [ ] **Step 1: Refondre le handler**

Remplacer le contenu de `src/app/api/jobs/[id]/route.ts` par :

```ts
import { queueRegistry } from '@/lib/queue/registry';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const url = new URL(req.url);
  const queueName = url.searchParams.get('queue') ?? 'dummy';
  const queue = queueRegistry[queueName];
  if (!queue) {
    return Response.json({ error: `Unknown queue: ${queueName}` }, { status: 400 });
  }
  const job = await queue.getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const state = await job.getState();
  return Response.json({
    id: job.id,
    queue: queueName,
    status: state,
    progress: job.progress,
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
  });
}
```

- [ ] **Step 2: Test manuel (avec worker dummy déjà existant)**

Démarrer la stack dev :

Run: `npm run dev:all`

Dans un autre terminal, enfile un dummy job via une petite commande tsx ad-hoc :

```bash
npx tsx -e "
import { enqueueDummy } from './src/lib/queue/enqueue';
const id = await enqueueDummy('test');
console.log('jobId:', id);
process.exit(0);
"
```

Récupérer le `jobId` printé, puis :

```bash
curl -s "http://localhost:3000/api/jobs/<JOBID>?queue=dummy" | jq .
```

Attendu : JSON avec `queue: "dummy"`, `status: "completed"` (ou `active`/`waiting` selon timing), `result: { ok: true, echoed: "test" }`.

Tester avec queue inconnue :

```bash
curl -sw "\n%{http_code}\n" "http://localhost:3000/api/jobs/abc?queue=foobar"
```

Attendu : `{"error":"Unknown queue: foobar"}` avec status 400.

Tuer la stack : `Ctrl+C` dans le terminal `dev:all`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/[id]/route.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(api/jobs): route généralisée via queueRegistry

Le query param ?queue=<name> sélectionne la queue (default 'dummy' pour
rétro-compat). Retourne 400 si queue inconnue. Permet à l'UI /ideas de
poller les jobs generate-post avec ?queue=generate-post.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 : AI Generation

### Task 8: `lintEditorial` (unit TDD)

Fonction pure qui applique les règles inviolables de la voice (pas de tiret cadratin notamment). TDD strict : test d'abord.

**Files:**
- Create: `src/lib/ai/lint-editorial.ts`
- Create: `test/unit/lint-editorial.test.ts`

- [ ] **Step 1: Écrire le test d'abord**

Créer `test/unit/lint-editorial.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { lintEditorial } from '@/lib/ai/lint-editorial';

describe('lintEditorial', () => {
  it('removes em-dashes and replaces by comma+space', () => {
    expect(lintEditorial('Il a dit — fais-le maintenant')).toBe('Il a dit, fais-le maintenant');
  });

  it('handles em-dash surrounded by spaces', () => {
    expect(lintEditorial('A — B — C')).toBe('A, B, C');
  });

  it('handles em-dash without surrounding spaces', () => {
    expect(lintEditorial('mot—mot')).toBe('mot, mot');
  });

  it('trims trailing whitespace lines and excessive blanks', () => {
    expect(lintEditorial('A\n\n\n\nB   \n')).toBe('A\n\nB');
  });

  it('leaves text without violations unchanged', () => {
    const ok = 'Voici un post propre.\n\nAvec deux paragraphes.';
    expect(lintEditorial(ok)).toBe(ok);
  });

  it('is idempotent', () => {
    const dirty = 'A — B\n\n\nC';
    const once = lintEditorial(dirty);
    const twice = lintEditorial(once);
    expect(twice).toBe(once);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il fail**

Run: `npm run test:unit -- lint-editorial`

Attendu : 6 tests FAIL avec "Cannot find module '@/lib/ai/lint-editorial'".

- [ ] **Step 3: Implémenter `src/lib/ai/lint-editorial.ts`**

```ts
/**
 * Applique les règles éditoriales inviolables de la voix (cohérentes avec
 * la default voice du seed) sur un texte généré par Claude.
 *
 * Règles :
 * - Pas de tiret cadratin (—) : remplacé par virgule + espace.
 * - Pas de lignes vides multiples (max 1 ligne vide entre paragraphes).
 * - Pas d'espaces de fin de ligne ni de fin de texte.
 *
 * Idempotent : lintEditorial(lintEditorial(x)) === lintEditorial(x).
 */
export function lintEditorial(text: string): string {
  let out = text;

  // Tiret cadratin : remplace par ", " (gère les espaces autour).
  out = out.replace(/\s*—\s*/g, ', ');

  // Espaces de fin de ligne.
  out = out.replace(/[ \t]+(\n|$)/g, '$1');

  // Lignes vides multiples → max 1 ligne vide.
  out = out.replace(/\n{3,}/g, '\n\n');

  // Trim global.
  out = out.trim();

  return out;
}
```

- [ ] **Step 4: Relancer les tests**

Run: `npm run test:unit -- lint-editorial`

Attendu : 6 PASS. Si un test fail, lire le diff et ajuster la regex (sans assouplir le test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/lint-editorial.ts test/unit/lint-editorial.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(ai): lintEditorial — règles inviolables post-génération

Pure function : strip tiret cadratin (→ ', '), espaces de fin de ligne,
lignes vides multiples. Idempotent. 6 tests unit TDD.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `buildSystemPrompt` + write + polish + generate composer

Logique IA complète. La fonction exportée `generate(deps)` est testable via injection ; en prod elle utilise `@anthropic-ai/sdk`.

**Files:**
- Create: `src/lib/ai/build-system-prompt.ts`
- Create: `src/lib/ai/generate-post.ts`
- Create: `test/unit/build-system-prompt.test.ts`

- [ ] **Step 1: Écrire le test pour buildSystemPrompt**

Créer `test/unit/build-system-prompt.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from '@/lib/ai/build-system-prompt';

describe('buildSystemPrompt', () => {
  it('includes voice content', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'Voice X' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).toContain('Voice X');
  });

  it('includes template structure', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'STRUCT-MARK', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).toContain('STRUCT-MARK');
  });

  it('includes writing rules if present', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: 'RULE-MARK', platform: 'linkedin' },
    });
    expect(prompt).toContain('RULE-MARK');
  });

  it('omits writing rules section if null', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt).not.toMatch(/règles d'écriture/i);
  });

  it('mentions the platform', () => {
    const prompt = buildSystemPrompt({
      voice: { content: 'V' },
      template: { name: 't', structure: 'S', writingRules: null, platform: 'linkedin' },
    });
    expect(prompt.toLowerCase()).toContain('linkedin');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il fail**

Run: `npm run test:unit -- build-system-prompt`

Attendu : FAIL "Cannot find module".

- [ ] **Step 3: Implémenter `src/lib/ai/build-system-prompt.ts`**

```ts
type VoiceInput = { content: string };
type TemplateInput = {
  name: string;
  structure: string;
  writingRules: string | null;
  platform: string;
};

export function buildSystemPrompt(opts: {
  voice: VoiceInput;
  template: TemplateInput;
}): string {
  const { voice, template } = opts;
  const rulesBlock = template.writingRules
    ? `\n\n## Règles d'écriture (template "${template.name}")\n\n${template.writingRules}`
    : '';

  return `Tu rédiges un post pour la plateforme ${template.platform}, en t'appropriant la voix éditoriale de l'auteur.

# Voix éditoriale

${voice.content}

# Structure cible (template "${template.name}")

${template.structure}${rulesBlock}

# Format de sortie

Réponds uniquement avec le texte du post final, sans préambule, sans guillemets, sans meta-commentaire. Le post doit pouvoir être copié-collé tel quel.`;
}
```

- [ ] **Step 4: Relancer les tests**

Run: `npm run test:unit -- build-system-prompt`

Attendu : 5 PASS.

- [ ] **Step 5: Implémenter `src/lib/ai/generate-post.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import type { Idea } from '@/lib/db/schemas/ideas';
import type { Voice } from '@/lib/db/schemas/voice';
import type { WritingTemplate } from '@/lib/db/schemas/writing-templates';
import { buildSystemPrompt } from './build-system-prompt';
import { lintEditorial } from './lint-editorial';

const MODEL = 'claude-sonnet-4-6';

export type GenerateInput = { idea: Idea; voice: Voice; template: WritingTemplate };
export type GenerateFn = (input: GenerateInput) => Promise<string>;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY manquante. Définis-la ou active CONTENT_OS_AI_STUB=1 pour les tests.',
    );
  }
  _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

async function extractText(response: Anthropic.Messages.Message): Promise<string> {
  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in Claude response');
  return block.text;
}

async function write(idea: Idea, systemPrompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Idée : ${idea.idea}\n\nBrief :\n${idea.brief ?? ''}\n\nRédige le post final en respectant strictement la voix éditoriale, la structure cible et les contraintes plateforme.`,
      },
    ],
  });
  return extractText(response);
}

async function polish(idea: Idea, draft: string, systemPrompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Idée d'origine : ${idea.idea}\n\nDraft :\n${draft}\n\nRelis et polis ce draft : resserre les phrases creuses, supprime les redondances, accentue la voix. Garde la même structure et la même longueur approximative. Réponds uniquement avec la version polie.`,
      },
    ],
  });
  return extractText(response);
}

/**
 * Implémentation par défaut de GenerateFn : appelle Claude write + polish + lint.
 * Le worker peut injecter une autre implémentation (stub) selon env.CONTENT_OS_AI_STUB.
 */
export const generate: GenerateFn = async ({ idea, voice, template }) => {
  const systemPrompt = buildSystemPrompt({ voice, template });
  const draft = await write(idea, systemPrompt);
  const polished = await polish(idea, draft, systemPrompt);
  return lintEditorial(polished);
};

/**
 * Implémentation stub utilisée quand CONTENT_OS_AI_STUB=1.
 * Retourne un contenu déterministe après 500ms pour simuler la latence.
 */
export const generateStub: GenerateFn = async ({ idea, template }) => {
  await new Promise((r) => setTimeout(r, 500));
  return `[STUB] Post généré pour l'idée "${idea.idea}" via le template "${template.name}".`;
};
```

- [ ] **Step 6: Vérifier le typecheck**

Run: `npx tsc --noEmit`

Attendu : 0 erreur. Si erreur sur les types `Voice` ou `WritingTemplate`, vérifier que les schemas exportent bien ces types (Spec 3).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/ test/unit/build-system-prompt.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(ai): buildSystemPrompt + generate (Claude Sonnet 4.6 write+polish)

Compose le prompt système à partir de voice + template. generate()
enchaîne write → polish → lintEditorial. generateStub() pour les tests
(retour immédiat 500ms après, contenu déterministe). Client Anthropic
lazy + erreur claire si ANTHROPIC_API_KEY absente sans stub activé.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 : Worker

### Task 10: Worker `generate-post` avec idempotency + tests

Logique du worker, branchement dans `worker/index.ts`, sélection stub vs réel via env, tests d'intégration.

**Files:**
- Create: `src/worker/queues/generate-post.ts`
- Modify: `src/worker/index.ts`
- Create: `test/worker/generate-post.test.ts`

- [ ] **Step 1: Créer `src/worker/queues/generate-post.ts`**

```ts
import type { Job } from 'bullmq';
import type { GenerateFn } from '@/lib/ai/generate-post';
import { getIdea } from '@/lib/db/repositories/ideas';
import {
  createPost,
  getPostByGenerationJobId,
} from '@/lib/db/repositories/posts';
import { getVoice } from '@/lib/db/repositories/voice';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import type { GeneratePostJob, GeneratePostResult } from '@/lib/queue/client';

type Deps = { generate: GenerateFn };

function isUniqueViolation(err: unknown): boolean {
  // Code Postgres 23505 = unique_violation.
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}

export function makeProcessGeneratePost(deps: Deps) {
  return async function processGeneratePost(
    job: Job<GeneratePostJob>,
  ): Promise<GeneratePostResult> {
    const { userId, ideaId, writingTemplateId, jobKey } = job.data;

    // 1. Idempotency check.
    const existing = await getPostByGenerationJobId(jobKey);
    if (existing) return { postId: existing.id };

    // 2. Charger les inputs.
    const idea = await getIdea(userId, ideaId);
    if (!idea) throw new Error(`Idea ${ideaId} not found for user ${userId}`);
    if (!idea.brief?.trim()) throw new Error(`Idea ${ideaId} has no brief`);

    const template = await getWritingTemplate(userId, writingTemplateId);
    if (!template) throw new Error(`WritingTemplate ${writingTemplateId} not found`);

    const voice = await getVoice(userId);
    if (!voice) throw new Error(`Voice missing for user ${userId} (should be seeded)`);

    // 3. Génération.
    const content = await deps.generate({ idea, voice, template });

    // 4. Insertion avec rattrapage de race condition.
    try {
      const post = await createPost(userId, {
        ideaId,
        content,
        writingTemplateId: template.id,
        generationJobId: jobKey,
      });
      return { postId: post.id };
    } catch (err) {
      if (isUniqueViolation(err)) {
        const racewinner = await getPostByGenerationJobId(jobKey);
        if (racewinner) return { postId: racewinner.id };
      }
      throw err;
    }
  };
}
```

- [ ] **Step 2: Étendre `src/worker/index.ts`**

Remplacer le fichier entier par :

```ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generate, generateStub } from '@/lib/ai/generate-post';
import { env } from '@/lib/env';
import { makeProcessGeneratePost } from './queues/generate-post';
import { processDummy } from './queues/dummy';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const generateFn = env.CONTENT_OS_AI_STUB === '1' ? generateStub : generate;
if (env.CONTENT_OS_AI_STUB === '1') {
  console.log('[worker] CONTENT_OS_AI_STUB=1 active : Claude NOT called.');
}

const workers = [
  new Worker('dummy', processDummy, { connection, concurrency: 4 }),
  new Worker('generate-post', makeProcessGeneratePost({ generate: generateFn }), {
    connection,
    concurrency: 4,
  }),
];

console.log(`[worker] ${workers.length} consumer(s) ready`);

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received, closing...`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 3: Créer `test/worker/generate-post.test.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProcessGeneratePost } from '@/worker/queues/generate-post';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import {
  createWritingTemplate,
  getWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import { upsertVoice } from '@/lib/db/repositories/voice';
import { createTestUser } from '../integration/helpers';

function makeJob<T>(data: T) {
  return { id: 'fake-bullmq-id', data, name: 'write+polish' } as never;
}

describe('processGeneratePost', () => {
  it('happy path : insère le post avec generationJobId', async () => {
    const userId = await createTestUser();
    await upsertVoice(userId);
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const idea = await createIdea(userId, { idea: 'titre', brief: 'brief détaillé' });
    const jobKey = randomUUID();

    const generate = vi.fn().mockResolvedValue('CONTENU FINAL');
    const handler = makeProcessGeneratePost({ generate });

    const result = await handler(makeJob({
      userId, ideaId: idea.id, writingTemplateId: tpl!.id, jobKey,
    }));

    const post = await getPost(userId, result.postId);
    expect(post?.content).toBe('CONTENU FINAL');
    expect(post?.generationJobId).toBe(jobKey);
    expect(post?.writingTemplateId).toBe(tpl!.id);
    expect(post?.status).toBe('draft');
    expect(generate).toHaveBeenCalledOnce();
  });

  it('idempotency : double-delivery ne crée qu\'un seul post', async () => {
    const userId = await createTestUser();
    await upsertVoice(userId);
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const idea = await createIdea(userId, { idea: 't', brief: 'b' });
    const jobKey = randomUUID();

    const generate = vi.fn().mockResolvedValue('contenu');
    const handler = makeProcessGeneratePost({ generate });

    const job = makeJob({ userId, ideaId: idea.id, writingTemplateId: tpl!.id, jobKey });
    const r1 = await handler(job);
    const r2 = await handler(job);

    expect(r1.postId).toBe(r2.postId);
    expect(generate).toHaveBeenCalledOnce(); // 2nd appel a court-circuité avant generate
  });

  it('idempotency : si le post existe déjà avec ce jobKey, retourne sans appeler generate', async () => {
    const userId = await createTestUser();
    await upsertVoice(userId);
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const idea = await createIdea(userId, { idea: 't', brief: 'b' });
    const jobKey = randomUUID();

    const existing = await createPost(userId, {
      ideaId: idea.id, content: 'pre-existant', generationJobId: jobKey,
    });

    const generate = vi.fn();
    const handler = makeProcessGeneratePost({ generate });

    const r = await handler(makeJob({
      userId, ideaId: idea.id, writingTemplateId: tpl!.id, jobKey,
    }));
    expect(r.postId).toBe(existing.id);
    expect(generate).not.toHaveBeenCalled();
  });

  it('throw si brief vide', async () => {
    const userId = await createTestUser();
    await upsertVoice(userId);
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const idea = await createIdea(userId, { idea: 'sans brief' });

    const generate = vi.fn();
    const handler = makeProcessGeneratePost({ generate });

    await expect(
      handler(makeJob({
        userId, ideaId: idea.id, writingTemplateId: tpl!.id, jobKey: randomUUID(),
      })),
    ).rejects.toThrow(/no brief/i);
    expect(generate).not.toHaveBeenCalled();
  });

  it('throw si idea introuvable', async () => {
    const userId = await createTestUser();
    await upsertVoice(userId);
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });

    const generate = vi.fn();
    const handler = makeProcessGeneratePost({ generate });
    await expect(
      handler(makeJob({
        userId, ideaId: 'unknown-id', writingTemplateId: tpl!.id, jobKey: randomUUID(),
      })),
    ).rejects.toThrow(/not found/i);
  });

  it('throw si writing_template appartient à un autre user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await upsertVoice(userA);
    await upsertVoice(userB);
    const tplB = await createWritingTemplate(userB, {
      name: 'TB', slug: 'tb', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const ideaA = await createIdea(userA, { idea: 't', brief: 'b' });

    const generate = vi.fn();
    const handler = makeProcessGeneratePost({ generate });
    await expect(
      handler(makeJob({
        userId: userA, ideaId: ideaA.id, writingTemplateId: tplB!.id, jobKey: randomUUID(),
      })),
    ).rejects.toThrow(/WritingTemplate.*not found/i);
  });
});
```

Si `createTestUser` n'est pas dans `test/integration/helpers`, lire `ls test/integration/helpers` et adapter l'import.

- [ ] **Step 4: Lancer les tests worker**

Run: `npm run test:worker -- generate-post`

Attendu : 6 PASS.

- [ ] **Step 5: Vérifier le typecheck global**

Run: `npx tsc --noEmit`

Attendu : 0 erreur.

- [ ] **Step 6: Commit**

```bash
git add src/worker/ test/worker/generate-post.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(worker): consumer generate-post (write+polish via Claude)

makeProcessGeneratePost factory pour injecter generate (stub ou réel
selon env.CONTENT_OS_AI_STUB). Idempotency via getPostByGenerationJobId
au début + rattrapage unique_violation à l'INSERT. 6 tests : happy
path, double-delivery, pré-insertion, brief vide, idea missing,
writing_template d'un autre user.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 : Server Actions

### Task 11: Server Actions ideas (wrapper/core split)

Pattern wrapper/core comme Spec 2/3. Le `requireUserId` factorise la session check.

**Files:**
- Create: `src/app/(app)/ideas/actions.ts`
- Create: `src/app/(app)/ideas/actions-core.ts`
- Create: `test/integration/ideas-actions.test.ts`

- [ ] **Step 1: Créer `src/app/(app)/ideas/actions-core.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createIdea,
  deleteIdea,
  getIdea,
  updateIdea,
} from '@/lib/db/repositories/ideas';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { enqueueGeneratePost } from '@/lib/queue/enqueue';

export type ActionState =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string };

const CreateSchema = z.object({
  idea: z.string().trim().min(1, 'Titre requis').max(500),
  brief: z.string().trim().max(20000).optional(),
});

export async function createIdeaCore(
  userId: string,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateSchema.safeParse({
    idea: formData.get('idea'),
    brief: formData.get('brief') || undefined,
  });
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  await createIdea(userId, parsed.data);
  return { status: 'success' };
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  idea: z.string().trim().min(1).max(500).optional(),
  brief: z
    .string()
    .trim()
    .max(20000)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v)),
});

export async function updateIdeaCore(
  userId: string,
  input: { id: string; idea?: string; brief?: string | null },
): Promise<ActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const { id, ...patch } = parsed.data;
  const updated = await updateIdea(userId, id, patch);
  if (!updated) return { status: 'error', message: 'Idée introuvable' };
  return { status: 'success' };
}

export async function deleteIdeaCore(userId: string, id: string): Promise<ActionState> {
  await deleteIdea(userId, id);
  return { status: 'success' };
}

export async function enqueueGeneratePostCore(
  userId: string,
  input: { ideaId: string; writingTemplateId: string },
): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const idea = await getIdea(userId, input.ideaId);
  if (!idea) return { status: 'error', message: 'Idée introuvable' };
  if (!idea.brief?.trim()) return { status: 'error', message: 'Brief requis pour générer' };
  const template = await getWritingTemplate(userId, input.writingTemplateId);
  if (!template) return { status: 'error', message: 'Template introuvable' };

  const jobKey = randomUUID();
  await enqueueGeneratePost({
    userId,
    ideaId: input.ideaId,
    writingTemplateId: input.writingTemplateId,
    jobKey,
  });
  return { status: 'success', jobKey };
}
```

- [ ] **Step 2: Créer `src/app/(app)/ideas/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import {
  type ActionState,
  createIdeaCore,
  deleteIdeaCore,
  enqueueGeneratePostCore,
  updateIdeaCore,
} from './actions-core';

export async function createIdeaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await createIdeaCore(userId, formData);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}

export async function updateIdeaAction(input: {
  id: string;
  idea?: string;
  brief?: string | null;
}): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await updateIdeaCore(userId, input);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}

export async function deleteIdeaAction(id: string): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await deleteIdeaCore(userId, id);
  if (result.status === 'success') revalidatePath('/ideas');
  return result;
}

export async function enqueueGeneratePostAction(input: {
  ideaId: string;
  writingTemplateId: string;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  return enqueueGeneratePostCore(userId, input);
}
```

- [ ] **Step 3: Écrire les tests integration**

Créer `test/integration/ideas-actions.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIdeaCore,
  deleteIdeaCore,
  enqueueGeneratePostCore,
  updateIdeaCore,
} from '@/app/(app)/ideas/actions-core';
import {
  createIdea,
  getIdea,
  listIdeas,
} from '@/lib/db/repositories/ideas';
import { createWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { createTestUser } from './helpers';

// Mock l'enqueue pour ne pas dépendre de Redis dans ce test.
vi.mock('@/lib/queue/enqueue', () => ({
  enqueueGeneratePost: vi.fn(async (p) => p.jobKey),
}));

describe('createIdeaCore', () => {
  it('crée une idée avec titre seul', async () => {
    const userId = await createTestUser();
    const fd = new FormData();
    fd.set('idea', 'Mon idée');
    const r = await createIdeaCore(userId, fd);
    expect(r.status).toBe('success');
    const list = await listIdeas(userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.brief).toBeNull();
  });

  it('crée une idée avec titre et brief', async () => {
    const userId = await createTestUser();
    const fd = new FormData();
    fd.set('idea', 'Titre');
    fd.set('brief', 'Brief détaillé');
    await createIdeaCore(userId, fd);
    const list = await listIdeas(userId);
    expect(list[0]?.brief).toBe('Brief détaillé');
  });

  it('refuse un titre vide', async () => {
    const userId = await createTestUser();
    const fd = new FormData();
    fd.set('idea', '   ');
    const r = await createIdeaCore(userId, fd);
    expect(r.status).toBe('error');
  });
});

describe('updateIdeaCore', () => {
  it('update partiel titre seul', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'A', brief: 'B' });
    const r = await updateIdeaCore(userId, { id: idea.id, idea: 'A bis' });
    expect(r.status).toBe('success');
    const reread = await getIdea(userId, idea.id);
    expect(reread?.idea).toBe('A bis');
    expect(reread?.brief).toBe('B');
  });

  it('update brief à null si chaîne vide', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'A', brief: 'B' });
    await updateIdeaCore(userId, { id: idea.id, brief: '' });
    const reread = await getIdea(userId, idea.id);
    expect(reread?.brief).toBeNull();
  });

  it('refuse update sur idea inexistante ou d\'un autre user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'A' });
    const r = await updateIdeaCore(userB, { id: ideaA.id, idea: 'B' });
    expect(r.status).toBe('error');
  });
});

describe('deleteIdeaCore', () => {
  it('supprime', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'X' });
    await deleteIdeaCore(userId, idea.id);
    expect(await getIdea(userId, idea.id)).toBeUndefined();
  });
});

describe('enqueueGeneratePostCore', () => {
  it('refuse si brief vide', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'sans brief' });
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const r = await enqueueGeneratePostCore(userId, {
      ideaId: idea.id, writingTemplateId: tpl!.id,
    });
    expect(r.status).toBe('error');
  });

  it('refuse si template d\'un autre user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'a', brief: 'b' });
    const tplB = await createWritingTemplate(userB, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const r = await enqueueGeneratePostCore(userA, {
      ideaId: ideaA.id, writingTemplateId: tplB!.id,
    });
    expect(r.status).toBe('error');
  });

  it('retourne un jobKey si tout est valide', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'titre', brief: 'brief' });
    const tpl = await createWritingTemplate(userId, {
      name: 'T', slug: 't', platform: 'linkedin', structure: 'S', writingRules: null,
    });
    const r = await enqueueGeneratePostCore(userId, {
      ideaId: idea.id, writingTemplateId: tpl!.id,
    });
    expect(r.status).toBe('success');
    if (r.status === 'success') {
      expect(r.jobKey).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
```

- [ ] **Step 4: Lancer les tests**

Run: `npm run test:integration -- ideas-actions`

Attendu : tous verts (~10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/ideas/ test/integration/ideas-actions.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(actions): Server Actions ideas (CRUD + enqueueGeneratePost)

Pattern wrapper/core (cohérent Spec 2/3) avec helper requireUserId().
Validation Zod : titre requis 1-500 chars, brief optionnel max 20k,
brief vide → null. enqueueGeneratePost refuse brief vide ou template
d'un autre user, génère le jobKey UUID v4 et le retourne pour le
polling côté UI.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Server Actions posts

Update content/status, delete. Pattern wrapper/core identique.

**Files:**
- Create: `src/app/(app)/posts/actions.ts`
- Create: `src/app/(app)/posts/actions-core.ts`
- Create: `test/integration/posts-actions.test.ts`

- [ ] **Step 1: Créer `src/app/(app)/posts/actions-core.ts`**

```ts
import { z } from 'zod';
import { deletePost, updatePost } from '@/lib/db/repositories/posts';
import type { ActionState } from '../ideas/actions-core';

const UpdateSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['draft', 'validated']).optional(),
});

export async function updatePostCore(
  userId: string,
  input: { id: string; content?: string; status?: 'draft' | 'validated' },
): Promise<ActionState> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) {
    return { status: 'error', message: 'Aucun champ à mettre à jour' };
  }
  const updated = await updatePost(userId, id, patch);
  if (!updated) return { status: 'error', message: 'Post introuvable' };
  return { status: 'success' };
}

export async function deletePostCore(userId: string, id: string): Promise<ActionState> {
  await deletePost(userId, id);
  return { status: 'success' };
}
```

- [ ] **Step 2: Créer `src/app/(app)/posts/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import type { ActionState } from '../ideas/actions-core';
import { deletePostCore, updatePostCore } from './actions-core';

export async function updatePostAction(input: {
  id: string;
  content?: string;
  status?: 'draft' | 'validated';
}): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await updatePostCore(userId, input);
  if (result.status === 'success') {
    revalidatePath('/posts');
    revalidatePath(`/posts/${input.id}`);
  }
  return result;
}

export async function deletePostAction(id: string): Promise<ActionState> {
  const userId = await requireUserId();
  const result = await deletePostCore(userId, id);
  if (result.status === 'success') revalidatePath('/posts');
  return result;
}
```

- [ ] **Step 3: Tests integration**

Créer `test/integration/posts-actions.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { deletePostCore, updatePostCore } from '@/app/(app)/posts/actions-core';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers';

describe('updatePostCore', () => {
  it('update content', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'old' });
    const r = await updatePostCore(userId, { id: post.id, content: 'new' });
    expect(r.status).toBe('success');
    expect((await getPost(userId, post.id))?.content).toBe('new');
  });

  it('toggle status draft → validated', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    expect(post.status).toBe('draft');
    await updatePostCore(userId, { id: post.id, status: 'validated' });
    expect((await getPost(userId, post.id))?.status).toBe('validated');
  });

  it('refuse sans aucun champ', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    const r = await updatePostCore(userId, { id: post.id });
    expect(r.status).toBe('error');
  });

  it('refuse update d\'un post d\'un autre user', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const ideaA = await createIdea(userA, { idea: 'i' });
    const postA = await createPost(userA, { ideaId: ideaA.id, content: 'c' });
    const r = await updatePostCore(userB, { id: postA.id, content: 'pwned' });
    expect(r.status).toBe('error');
  });
});

describe('deletePostCore', () => {
  it('supprime', async () => {
    const userId = await createTestUser();
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    await deletePostCore(userId, post.id);
    expect(await getPost(userId, post.id)).toBeUndefined();
  });
});
```

- [ ] **Step 4: Lancer les tests**

Run: `npm run test:integration -- posts-actions`

Attendu : 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/posts/ test/integration/posts-actions.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(actions): Server Actions posts (update content/status, delete)

updatePostCore patch content et/ou status (draft|validated). Refuse
les patches vides. Test integration : update, toggle status, refus
tenant-cross. Le bouton 'Valider' et l'édition du contenu reposeront
sur cette action depuis la page /posts/[id].

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 : UI

### Task 13: Composants shadcn manquants

Vérifier que `<Select>` shadcn est installé (utilisé par le dropdown writing_template). Si non, l'installer.

**Files:**
- Modify (peut-être): `src/components/ui/select.tsx`

- [ ] **Step 1: Vérifier la présence de Select**

Run: `ls src/components/ui/`

Si `select.tsx` est absent :

Run: `npx shadcn@latest add select`

Confirmer Y si demandé. Vérifier qu'il apparaît dans `src/components/ui/select.tsx`.

- [ ] **Step 2: Vérifier Card / Badge / Skeleton**

```bash
ls src/components/ui/ | grep -E '^(card|badge|skeleton|dialog)\.tsx$'
```

Manquants ? Installer un par un :

```bash
npx shadcn@latest add card badge skeleton dialog
```

(Choisir Y pour chaque.)

- [ ] **Step 3: Commit (si install)**

```bash
git add src/components/ui/ components.json package.json package-lock.json 2>/dev/null
git commit -m "$(cat <<'EOF'
🤖 chore(ui): install shadcn select/card/badge/skeleton/dialog

Composants nécessaires pour les pages /ideas et /posts (Spec 4).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Si rien à committer, skip.

---

### Task 14: Hook `useJobPolling`

Encapsule le polling `/api/jobs/[id]?queue=...` toutes les 2s avec toast à la fin.

**Files:**
- Create: `src/hooks/use-job-polling.ts`

- [ ] **Step 1: Créer le hook**

```ts
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export type JobState = {
  id: string;
  queue: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number | object;
  result: unknown;
  error: string | null;
};

type Options = {
  queue: string;
  /** Appelé quand le job se termine avec succès. result est le retour du worker. */
  onCompleted?: (result: unknown) => void;
  /** Toast par défaut sur succès. Désactiver si onCompleted gère son propre toast. */
  defaultToast?: boolean;
};

export function useJobPolling(jobKey: string | null, opts: Options) {
  const [state, setState] = useState<JobState | null>(null);
  const router = useRouter();
  const { queue, onCompleted, defaultToast = true } = opts;

  useEffect(() => {
    if (!jobKey) return;
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/jobs/${jobKey}?queue=${queue}`);
          if (!res.ok) {
            if (!cancelled) setState({
              id: jobKey, queue, status: 'failed', progress: 0,
              result: null, error: `HTTP ${res.status}`,
            });
            return;
          }
          const json = (await res.json()) as JobState;
          if (cancelled) return;
          setState(json);

          if (json.status === 'completed') {
            if (defaultToast) {
              toast.success('Post créé', {
                action: typeof json.result === 'object' && json.result && 'postId' in json.result
                  ? {
                      label: 'Voir',
                      onClick: () => router.push(`/posts/${(json.result as { postId: string }).postId}`),
                    }
                  : undefined,
              });
            }
            onCompleted?.(json.result);
            router.refresh();
            return;
          }
          if (json.status === 'failed') {
            toast.error(`Génération échouée : ${json.error ?? 'erreur inconnue'}`);
            return;
          }
        } catch (err) {
          if (!cancelled) {
            toast.error(`Polling échoué : ${err instanceof Error ? err.message : 'erreur'}`);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobKey, queue, onCompleted, defaultToast, router]);

  return state;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Attendu : 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-job-polling.ts
git commit -m "$(cat <<'EOF'
🤖 feat(hooks): useJobPolling pour suivre les jobs BullMQ depuis l'UI

Poll /api/jobs/[id]?queue=... toutes les 2s. À completion, toast 'Post
créé' avec lien vers /posts/[id] + router.refresh(). À failure, toast
d'erreur. Annulé automatiquement au unmount.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Page `/ideas` (Server Component + IdeaCreateForm)

Liste + formulaire de création. La card sera en Task 16.

**Files:**
- Create: `src/app/(app)/ideas/page.tsx`
- Create: `src/app/(app)/ideas/_components/idea-create-form.tsx`
- Create: `src/app/(app)/ideas/_components/empty-state.tsx`

- [ ] **Step 1: Créer `src/app/(app)/ideas/_components/idea-create-form.tsx`**

```tsx
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createIdeaAction } from '../actions';
import type { ActionState } from '../actions-core';

const INITIAL: ActionState = { status: 'idle' };

export function IdeaCreateForm() {
  const [state, formAction, isPending] = useActionState(createIdeaAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Idée capturée');
      formRef.current?.reset();
    } else if (state.status === 'error') {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Nouvelle idée</h2>
      <Input
        name="idea"
        placeholder="Titre de l'idée"
        required
        maxLength={500}
        disabled={isPending}
      />
      <Textarea
        name="brief"
        placeholder="Brief (optionnel) : angle, contexte, exemples..."
        rows={4}
        maxLength={20000}
        disabled={isPending}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Ajout...' : 'Ajouter'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Tu pourras éditer le brief et générer un post depuis la liste.
        </p>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/ideas/_components/empty-state.tsx`**

```tsx
export function EmptyIdeasState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      Aucune idée pour le moment. Capture ta première au-dessus.
    </div>
  );
}
```

- [ ] **Step 3: Créer `src/app/(app)/ideas/page.tsx`**

```tsx
import { requireUserId } from '@/lib/auth/session';
import {
  countPostsByIdea,
  listIdeas,
  listPostsByIdea,
} from '@/lib/db/repositories/ideas';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { EmptyIdeasState } from './_components/empty-state';
import { IdeaCreateForm } from './_components/idea-create-form';
import { IdeaCard } from './_components/idea-card';

export default async function IdeasPage() {
  const userId = await requireUserId();
  const ideas = await listIdeas(userId);
  const templates = await listWritingTemplates(userId);
  const postsByIdea = new Map<string, Awaited<ReturnType<typeof listPostsByIdea>>>();
  for (const idea of ideas) {
    postsByIdea.set(idea.id, await listPostsByIdea(userId, idea.id));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Idées ({ideas.length})</h1>
      </header>
      <IdeaCreateForm />
      {ideas.length === 0 ? (
        <EmptyIdeasState />
      ) : (
        <div className="space-y-4">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              posts={postsByIdea.get(idea.id) ?? []}
              templates={templates}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

L'import de `IdeaCard` va casser le build tant que Task 16 n'est pas faite. C'est intentionnel — on commit phase par phase et la prochaine task rétablit la compilation.

- [ ] **Step 4: Skip typecheck pour ce commit intermédiaire**

(Task 16 rétablit la compilation.) Si vraiment besoin d'un check intermédiaire, créer un stub temporaire :

```tsx
// src/app/(app)/ideas/_components/idea-card.tsx — STUB temporaire
export function IdeaCard(_: { idea: any; posts: any; templates: any }) { return null; }
```

À remplacer par la vraie implémentation Task 16.

- [ ] **Step 5: Commit (avec ou sans stub)**

Si stub créé :

```bash
git add src/app/\(app\)/ideas/
git commit -m "$(cat <<'EOF'
🤖 feat(ideas): page /ideas + form de création (card stub)

Server Component liste les ideas, leurs posts liés et les writing
templates. Form de création en Client Component avec useActionState +
sonner. IdeaCard stubbée — implémentée Task 16.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Sinon, attendre Task 16 et faire un commit groupé. Au choix de l'exécutant.

---

### Task 16: Composant `IdeaCard` (édition inline + génération)

Card complète : blur-to-save titre/brief, dropdown template, bouton Générer avec polling, suppression avec confirm.

**Files:**
- Create: `src/app/(app)/ideas/_components/idea-card.tsx`
- Create: `src/app/(app)/ideas/_components/delete-idea-dialog.tsx`

- [ ] **Step 1: Créer `src/app/(app)/ideas/_components/delete-idea-dialog.tsx`**

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
import { deleteIdeaAction } from '../actions';

export function DeleteIdeaDialog({ ideaId, trigger }: { ideaId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const r = await deleteIdeaAction(ideaId);
      if (r.status === 'success') {
        toast.success('Idée supprimée');
        setOpen(false);
      } else {
        toast.error(r.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer cette idée ?</DialogTitle>
          <DialogDescription>
            Les posts générés depuis cette idée seront aussi supprimés. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/ideas/_components/idea-card.tsx`**

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useJobPolling } from '@/hooks/use-job-polling';
import type { Idea, Post, WritingTemplate } from '@/lib/db/schema';
import { enqueueGeneratePostAction, updateIdeaAction } from '../actions';
import { DeleteIdeaDialog } from './delete-idea-dialog';

type Props = {
  idea: Idea;
  posts: Post[];
  templates: WritingTemplate[];
};

export function IdeaCard({ idea, posts, templates }: Props) {
  const [briefValue, setBriefValue] = useState(idea.brief ?? '');
  const [titleValue, setTitleValue] = useState(idea.idea);
  const [savingTitle, startSaveTitle] = useTransition();
  const [savingBrief, startSaveBrief] = useTransition();
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [jobKey, setJobKey] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  const jobState = useJobPolling(jobKey, {
    queue: 'generate-post',
    onCompleted: () => setJobKey(null),
  });

  const isJobActive =
    jobKey !== null && jobState !== null && jobState.status !== 'completed' && jobState.status !== 'failed';

  const briefIsEmpty = briefValue.trim().length === 0;
  const canGenerate = !briefIsEmpty && templates.length > 0 && !isJobActive && !generating;

  const saveTitle = () => {
    if (titleValue.trim() === idea.idea.trim() || !titleValue.trim()) return;
    startSaveTitle(async () => {
      const r = await updateIdeaAction({ id: idea.id, idea: titleValue.trim() });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const saveBrief = () => {
    if ((briefValue.trim() || null) === (idea.brief?.trim() || null)) return;
    startSaveBrief(async () => {
      const r = await updateIdeaAction({ id: idea.id, brief: briefValue });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const onGenerate = () => {
    if (!templateId) return;
    startGenerate(async () => {
      const r = await enqueueGeneratePostAction({ ideaId: idea.id, writingTemplateId: templateId });
      if (r.status === 'success') {
        setJobKey(r.jobKey);
      } else {
        toast.error(r.message);
      }
    });
  };

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          #{idea.id.slice(0, 8)} · {new Date(idea.createdAt).toLocaleDateString('fr-FR')}
        </span>
        <DeleteIdeaDialog
          ideaId={idea.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer l'idée">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </header>

      <Input
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        onBlur={saveTitle}
        placeholder="Titre de l'idée"
        disabled={savingTitle}
      />

      <Textarea
        value={briefValue}
        onChange={(e) => setBriefValue(e.target.value)}
        onBlur={saveBrief}
        placeholder="Brief : angle, contexte, exemples..."
        rows={3}
        disabled={savingBrief}
      />

      {posts.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {posts.length} post{posts.length > 1 ? 's' : ''} généré{posts.length > 1 ? 's' : ''} :{' '}
          {posts.map((p, i) => (
            <span key={p.id}>
              <Link href={`/posts/${p.id}`} className="underline">
                #{p.id.slice(0, 6)}
              </Link>
              {i < posts.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {templates.length > 0 ? (
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.platform})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">
            Pas de writing_template — créez-en un dans Settings.
          </span>
        )}
        <Button onClick={onGenerate} disabled={!canGenerate}>
          {isJobActive ? 'Génération...' : 'Générer un post'}
        </Button>
        {briefIsEmpty && (
          <span className="text-xs text-muted-foreground">Brief requis</span>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Attendu : 0 erreur. Si erreur sur les imports de types `Idea` / `Post` / `WritingTemplate`, vérifier que le barrel `src/lib/db/schema.ts` les exporte tous.

- [ ] **Step 4: Smoke visuel**

Run: `npm run dev:all`

(En s'assurant que `CONTENT_OS_AI_STUB=1` est dans `.env` pour ne pas appeler Claude.)

1. Naviguer vers `http://localhost:3000/signin`, sign in en magic link.
2. Aller sur `/ideas`.
3. Créer une idée "Test pipeline" sans brief → card apparaît, bouton "Générer un post" disabled, message "Brief requis".
4. Cliquer dans le textarea brief, taper 2 phrases, tabber (blur) → silencieux (pas de toast à chaque blur, normal).
5. Le bouton "Générer un post" passe enabled.
6. Cliquer "Générer un post" → bouton devient "Génération...", après ~500ms toast "Post créé" avec lien "Voir".
7. Cliquer "Voir" → 404 attendu (page Posts pas encore créée — Task 17).
8. Retour `/ideas`, la pastille "1 post généré : #xxx" apparaît sur la card.
9. Tester la suppression : icône poubelle → dialog → confirmer → toast "Idée supprimée", card disparaît.

Tuer la stack : `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/ideas/
git commit -m "$(cat <<'EOF'
🤖 feat(ideas): IdeaCard avec édition inline + génération async

Blur-to-save sur titre et brief via updateIdeaAction. Dropdown shadcn
Select pour le writing_template. Bouton 'Générer' enfile un job
BullMQ (Server Action retourne le jobKey), hook useJobPolling poll
/api/jobs/[id]?queue=generate-post toutes les 2s, toast 'Post créé'
+ refresh à la fin. Dialog de suppression avec cascade FK sur les
posts liés.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Page `/posts` (liste)

Liste des posts du user avec join sur l'idée source. Cards cliquables vers `/posts/[id]`.

**Files:**
- Create: `src/app/(app)/posts/page.tsx`
- Create: `src/app/(app)/posts/_components/post-card.tsx`
- Create: `src/app/(app)/posts/_components/empty-state.tsx`

- [ ] **Step 1: Créer `src/app/(app)/posts/_components/empty-state.tsx`**

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function EmptyPostsState() {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">Aucun post pour le moment.</p>
      <Button asChild>
        <Link href="/ideas">Aller capturer une idée →</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/posts/_components/post-card.tsx`**

```tsx
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { Post } from '@/lib/db/schema';

type Props = {
  post: Post;
  idea: { id: string; idea: string };
};

export function PostCard({ post, idea }: Props) {
  const excerpt = post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content;
  return (
    <Link href={`/posts/${post.id}`} className="block">
      <article className="space-y-2 rounded-lg border p-4 transition hover:bg-muted/40">
        <header className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Source : {idea.idea}</span>
          <Badge variant={post.status === 'validated' ? 'default' : 'secondary'}>
            {post.status}
          </Badge>
        </header>
        <p className="whitespace-pre-wrap text-sm">{excerpt}</p>
        <footer className="flex items-center justify-between text-xs text-muted-foreground">
          <span>#{post.id.slice(0, 8)}</span>
          <span>
            {new Date(post.updatedAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        </footer>
      </article>
    </Link>
  );
}
```

- [ ] **Step 3: Créer `src/app/(app)/posts/page.tsx`**

```tsx
import { requireUserId } from '@/lib/auth/session';
import { listPostsWithIdea } from '@/lib/db/repositories/posts';
import { EmptyPostsState } from './_components/empty-state';
import { PostCard } from './_components/post-card';

export default async function PostsPage() {
  const userId = await requireUserId();
  const rows = await listPostsWithIdea(userId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Posts ({rows.length})</h1>
      </header>
      {rows.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <PostCard key={row.post.id} post={row.post} idea={row.idea} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke visuel**

Run: `npm run dev:all`

1. Aller sur `/posts` après avoir généré au moins un post (Task 16).
2. Vérifier : titre "Posts (N)", grille de cards avec extrait, badge `draft`, lien fonctionnel vers `/posts/[id]` (qui renvoie 404 tant que Task 18 pas faite).
3. État vide : supprimer tous les posts, recharger → "Aucun post pour le moment" + bouton vers `/ideas`.

Tuer : `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/posts/page.tsx src/app/\(app\)/posts/_components/
git commit -m "$(cat <<'EOF'
🤖 feat(posts): page /posts (liste avec join idée source)

Grille 2 colonnes de cards (extrait 200 chars + badge status + titre
idée source + date). Empty state pointe vers /ideas. Pas de filtre ni
pagination au MVP : tout en mémoire via listPostsWithIdea (leftJoin
qui évite le N+1).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Page `/posts/[id]` (détail + édition + valider)

Textarea full-width, blur-to-save, toggle status, suppression. Pastille `Pas de visuel` discrète.

**Files:**
- Create: `src/app/(app)/posts/[id]/page.tsx`
- Create: `src/app/(app)/posts/[id]/_components/post-editor.tsx`
- Create: `src/app/(app)/posts/[id]/_components/delete-post-dialog.tsx`

- [ ] **Step 1: Créer `src/app/(app)/posts/[id]/_components/delete-post-dialog.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
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
import { deletePostAction } from '../../actions';

export function DeletePostDialog({ postId, trigger }: { postId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onConfirm = () => {
    startTransition(async () => {
      const r = await deletePostAction(postId);
      if (r.status === 'success') {
        toast.success('Post supprimé');
        router.push('/posts');
      } else {
        toast.error(r.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer ce post ?</DialogTitle>
          <DialogDescription>
            Le post sera définitivement supprimé. L'idée source reste intacte.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Créer `src/app/(app)/posts/[id]/_components/post-editor.tsx`**

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Idea, Post } from '@/lib/db/schema';
import { updatePostAction } from '../../actions';
import { DeletePostDialog } from './delete-post-dialog';

type Props = { post: Post; idea: Idea };

export function PostEditor({ post, idea }: Props) {
  const [content, setContent] = useState(post.content);
  const [status, setStatus] = useState<'draft' | 'validated'>(post.status);
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();

  const saveContent = () => {
    if (content.trim() === post.content.trim() || !content.trim()) return;
    startSave(async () => {
      const r = await updatePostAction({ id: post.id, content });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const toggleStatus = () => {
    const next: 'draft' | 'validated' = status === 'draft' ? 'validated' : 'draft';
    startToggle(async () => {
      const r = await updatePostAction({ id: post.id, status: next });
      if (r.status === 'success') {
        setStatus(next);
        toast.success(next === 'validated' ? 'Post validé' : 'Remis en draft');
      } else {
        toast.error(r.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{idea.idea}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'validated' ? 'default' : 'secondary'}>{status}</Badge>
            {post.mediaId === null && (
              <Badge variant="outline" className="text-muted-foreground">
                Pas de visuel
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Post #{post.id.slice(0, 8)} · créé le{' '}
          {new Date(post.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </header>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        rows={20}
        disabled={saving}
        className="font-mono"
      />

      <footer className="flex items-center justify-between gap-3">
        <Button onClick={toggleStatus} disabled={toggling}>
          {status === 'draft' ? 'Valider' : 'Remettre en draft'}
        </Button>
        <DeletePostDialog
          postId={post.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer le post">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Créer `src/app/(app)/posts/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUserId } from '@/lib/auth/session';
import { getIdea } from '@/lib/db/repositories/ideas';
import { getPost } from '@/lib/db/repositories/posts';
import { Button } from '@/components/ui/button';
import { PostEditor } from './_components/post-editor';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const post = await getPost(userId, id);
  if (!post) notFound();
  const idea = await getIdea(userId, post.ideaId);
  if (!idea) notFound();

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/posts">← Tous les posts</Link>
      </Button>
      <PostEditor post={post} idea={idea} />
    </div>
  );
}
```

- [ ] **Step 4: Smoke visuel**

Run: `npm run dev:all`

1. Depuis `/posts`, cliquer une card → arrive sur `/posts/[id]`.
2. Vérifier : titre = idée source, badge `draft`, badge `Pas de visuel` (outline gris), textarea avec le contenu, bouton Valider.
3. Éditer le contenu, tabber → save silencieux.
4. Recharger la page → modifs persistées.
5. Cliquer Valider → toast "Post validé", badge passe à `validated`, bouton devient "Remettre en draft".
6. Cliquer "Remettre en draft" → toast "Remis en draft", badge revient à `draft`.
7. Cliquer la poubelle → dialog → confirmer → toast + redirect `/posts`.

Tuer : `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/posts/\[id\]/
git commit -m "$(cat <<'EOF'
🤖 feat(posts): page /posts/[id] (édition + toggle status + delete)

Textarea full-width font-mono, blur-to-save via updatePostAction.
Toggle draft ↔ validated (validated reste éditable, retour draft
possible). Dialog suppression avec redirect /posts. Pastille
'Pas de visuel' discrète quand mediaId null (Spec 5 ajoutera le CTA).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Sidebar — ajout des liens `Idées` et `Posts`

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (ou équivalent posé Spec 3)

- [ ] **Step 1: Identifier le fichier sidebar**

Run: `grep -rn "Settings\|settings/brand" src/components/layout/ src/app/\(app\)/ --include="*.tsx" -l | head -5`

Identifier le fichier qui contient la nav latérale. Probablement `src/components/layout/sidebar.tsx` ou `app/(app)/layout.tsx`.

- [ ] **Step 2: Ajouter les deux liens en haut**

Repérer la structure de la nav existante (pattern items avec `href` + `label` + `icon`). Ajouter en haut, avant le groupe Settings :

```tsx
const APP_LINKS = [
  { href: '/ideas', label: 'Idées', icon: Lightbulb },
  { href: '/posts', label: 'Posts', icon: FileText },
];
```

Les imports : `import { FileText, Lightbulb } from 'lucide-react';`

Puis dans le rendu, mapper avant le bloc Settings :

```tsx
{APP_LINKS.map((link) => (
  <Link
    key={link.href}
    href={link.href}
    className={cn(
      'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
      pathname === link.href ? 'bg-muted font-medium' : 'hover:bg-muted/50',
    )}
  >
    <link.icon className="h-4 w-4" />
    {link.label}
  </Link>
))}
```

Adapter au style exact de la sidebar existante (le bloc ci-dessus est indicatif).

- [ ] **Step 3: Smoke visuel**

Run: `npm run dev:all`

Vérifier que la sidebar affiche `Idées` et `Posts` en haut, que les liens fonctionnent, et que le lien actif est highlight correctement.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/
git commit -m "$(cat <<'EOF'
🤖 feat(layout): sidebar liens Idées / Posts au-dessus de Settings

Les deux entités produit (idea, post) sont désormais accessibles en
1 clic depuis n'importe quelle page de l'app.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 : Tests E2E et vérification finale

### Task 20: E2E Playwright `/ideas` (création, édition, génération)

Test happy path avec stub worker pour ne pas dépendre de Claude.

**Files:**
- Create: `test/e2e/ideas.spec.ts`

- [ ] **Step 1: Vérifier que `CONTENT_OS_AI_STUB=1` est utilisé en E2E**

Run: `cat playwright.config.ts`

Vérifier la section `webServer` (ou équivalent) : confirmer que le worker démarré pour les E2E a bien `CONTENT_OS_AI_STUB=1` dans son env. Si non, l'ajouter :

```ts
webServer: [
  {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    env: { ... existing },
    timeout: 60_000,
  },
  {
    command: 'npm run worker',
    env: { CONTENT_OS_AI_STUB: '1' },
    timeout: 30_000,
  },
],
```

(Si le webServer worker n'existe pas, l'ajouter — il est nécessaire pour traiter les jobs en E2E.)

- [ ] **Step 2: Regarder un E2E existant pour le pattern de signup**

Run: `cat test/e2e/settings-brand.spec.ts | head -40`

Identifier la fonction helper de signup magic-link (ou cookie injection). Réutiliser dans le nouveau test.

- [ ] **Step 3: Créer `test/e2e/ideas.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { signInAsTestUser } from './helpers'; // ajuster le chemin selon le helper existant

test.describe('/ideas', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('crée une idée sans brief, bouton Générer disabled', async ({ page }) => {
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Test idée pipeline');
    await page.click('button:has-text("Ajouter")');
    await expect(page.locator('text=Test idée pipeline').first()).toBeVisible();
    await expect(page.locator('text=Brief requis').first()).toBeVisible();
    const generateButton = page.locator('button:has-text("Générer un post")').first();
    await expect(generateButton).toBeDisabled();
  });

  test('édite le brief inline, génère un post (stub), voit le toast', async ({ page }) => {
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Idée pour générer');
    await page.fill('textarea[name="brief"]', 'Brief détaillé pour la génération');
    await page.click('button:has-text("Ajouter")');

    // Le card est créé. Brief est rempli, bouton enabled.
    const card = page.locator('article', { hasText: 'Idée pour générer' });
    await expect(card.locator('button:has-text("Générer un post")')).toBeEnabled();
    await card.locator('button:has-text("Générer un post")').click();

    // Stub : toast après ~500ms.
    await expect(page.locator('text=Post créé')).toBeVisible({ timeout: 10_000 });

    // Le card doit afficher "1 post généré" après refresh.
    await page.waitForTimeout(500);
    await expect(card.locator('text=/1 post généré/')).toBeVisible();
  });

  test('édite titre/brief sur un card existant, blur sauvegarde', async ({ page }) => {
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Avant édition');
    await page.click('button:has-text("Ajouter")');

    const card = page.locator('article', { hasText: 'Avant édition' });
    await card.locator('input').first().fill('Après édition');
    await card.locator('input').first().blur();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('text=Après édition').first()).toBeVisible();
  });

  test('supprime une idée via le dialog', async ({ page }) => {
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'À supprimer');
    await page.click('button:has-text("Ajouter")');

    const card = page.locator('article', { hasText: 'À supprimer' });
    await card.locator('button[aria-label*="Supprimer"]').click();
    await page.click('button:has-text("Supprimer"):not([aria-label])');
    await expect(page.locator('text=Idée supprimée')).toBeVisible();
    await expect(card).toHaveCount(0);
  });
});
```

Le sélecteur `button:has-text("Supprimer"):not([aria-label])` distingue le bouton du dialog (sans aria-label) du trigger icône (avec aria-label).

- [ ] **Step 4: Lancer le test**

Run: `npx playwright test test/e2e/ideas.spec.ts`

Attendu : 4 PASS. Si fail, lancer en mode debug : `npx playwright test test/e2e/ideas.spec.ts --debug`.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/ideas.spec.ts playwright.config.ts
git commit -m "$(cat <<'EOF'
🤖 test(e2e): /ideas (create, edit, generate via stub, delete)

4 tests Playwright happy path. Worker E2E démarré avec
CONTENT_OS_AI_STUB=1 pour ne pas dépendre de Claude. Couvre la
création, le toggle disabled/enabled du bouton selon brief,
l'enqueue + polling + toast, l'édition inline blur-to-save,
la suppression.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: E2E Playwright `/posts/[id]`

**Files:**
- Create: `test/e2e/posts.spec.ts`

- [ ] **Step 1: Créer le test**

```ts
import { expect, test } from '@playwright/test';
import { signInAsTestUser } from './helpers';

test.describe('/posts/[id]', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('génère un post, ouvre le détail, édite, valide, supprime', async ({ page }) => {
    // 1. Créer une idée et générer un post (via le flow UI réel + stub).
    await page.goto('/ideas');
    await page.fill('input[name="idea"]', 'Idée pour /posts/[id]');
    await page.fill('textarea[name="brief"]', 'brief');
    await page.click('button:has-text("Ajouter")');
    const card = page.locator('article', { hasText: 'Idée pour /posts/[id]' });
    await card.locator('button:has-text("Générer un post")').click();
    await expect(page.locator('text=Post créé')).toBeVisible({ timeout: 10_000 });

    // 2. Cliquer le lien "Voir" dans le toast OU naviguer via la pastille post.
    await page.waitForTimeout(500);
    await page.reload();
    const postLink = card.locator('a[href^="/posts/"]').first();
    await postLink.click();

    // 3. Sur la page détail.
    await expect(page.locator('h1', { hasText: 'Idée pour /posts/[id]' })).toBeVisible();
    await expect(page.locator('text=draft').first()).toBeVisible();
    await expect(page.locator('text=Pas de visuel').first()).toBeVisible();

    // 4. Édition du contenu.
    const textarea = page.locator('textarea').first();
    await textarea.fill('Nouveau contenu modifié');
    await textarea.blur();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('textarea').first()).toHaveValue('Nouveau contenu modifié');

    // 5. Validation.
    await page.click('button:has-text("Valider")');
    await expect(page.locator('text=Post validé')).toBeVisible();
    await expect(page.locator('text=validated').first()).toBeVisible();
    await expect(page.locator('button:has-text("Remettre en draft")')).toBeVisible();

    // 6. Suppression.
    await page.locator('button[aria-label*="Supprimer le post"]').click();
    await page.click('button:has-text("Supprimer"):not([aria-label])');
    await expect(page).toHaveURL('/posts');
    await expect(page.locator('text=Post supprimé')).toBeVisible();
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx playwright test test/e2e/posts.spec.ts`

Attendu : 1 PASS (test long).

- [ ] **Step 3: Commit**

```bash
git add test/e2e/posts.spec.ts
git commit -m "$(cat <<'EOF'
🤖 test(e2e): /posts/[id] flow complet (génère, édite, valide, supprime)

Un seul test long qui enchaîne tout le cycle de vie d'un post depuis
sa génération jusqu'à sa suppression, en passant par l'édition inline
et le toggle draft ↔ validated.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Verification finale et nettoyage

**Files:** aucun à modifier en priorité — diagnostic et fixs au cas par cas.

- [ ] **Step 1: Lancer toute la suite de tests**

Run: `npm test`

Attendu : tous les projects (unit + integration + worker) verts.

Si fail :
- Lire l'erreur, fixer, recommencer.
- Si le test integration `user-defaults-seed` casse à cause de la nouvelle colonne sur posts, vérifier le `test/setup-integration.ts` (déjà OK) et la migration.

- [ ] **Step 2: Lancer la suite E2E**

Run: `npx playwright test`

Attendu : tous les specs verts.

- [ ] **Step 3: Lint et format**

Run: `npm run lint`

Si erreurs : `npm run format` (auto-fix Biome) puis re-lint.

- [ ] **Step 4: Build de production**

Run: `npm run build`

Attendu : build OK, aucune erreur TypeScript ni warning bloquant.

- [ ] **Step 5: Walkthrough manuel des critères de réussite**

Run: `npm run dev:all`

Vérifier dans l'ordre les critères de réussite du spec (`docs/superpowers/specs/2026-05-23-spec-4-pipeline-ideas-posts-design.md` § Critères de réussite) :

1. Accéder à `/ideas` et `/posts` après signin.
2. Créer une idée avec titre seul, vérifier bouton disabled.
3. Éditer brief, blur, vérifier bouton enabled.
4. Cliquer "Générer", attendre toast, suivre le lien.
5. Éditer contenu sur `/posts/[id]`, blur, recharger.
6. Cliquer "Valider", vérifier badge.
7. Supprimer, vérifier redirect.
8. Re-générer sur même idée, vérifier pastille "2 posts générés".
9. Supprimer l'idée, vérifier cascade DELETE sur les posts.

Si un critère n'est pas satisfait : créer un fix en mode "addendum" (petit commit ciblé), pas en réouvrant les tasks ci-dessus.

- [ ] **Step 6: Vérifier qu'aucun appel IA synchrone n'est dans le `web`**

Run: `grep -rn "anthropic\|@anthropic-ai" src/app/ src/components/ 2>/dev/null`

Attendu : 0 résultat. Si quelque chose remonte, c'est qu'une route ou un composant appelle Claude — le déplacer dans `src/lib/ai/` et l'invoquer depuis le worker.

- [ ] **Step 7: Vérifier le README ou un changelog si l'usage l'exige**

Run: `grep -l "ANTHROPIC_API_KEY" README.md 2>/dev/null`

Si la doc projet liste les env vars : y ajouter `ANTHROPIC_API_KEY` et `CONTENT_OS_AI_STUB`. Sinon skip.

- [ ] **Step 8: Commit final de cleanup (si fixs)**

Si des fixs en addendum ont été nécessaires :

```bash
git add -u
git commit -m "$(cat <<'EOF'
🤖 chore(spec-4): addendum post-walkthrough

[décrire les fixs apportés]

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Si rien à committer (walkthrough clean), skip.

---

## Self-Review

**Spec coverage :**

| Section spec | Task(s) |
|---|---|
| Migration `posts.generation_job_id` | Task 2 |
| Repos ideas extensions (listIdeas DESC, listPostsByIdea, countPostsByIdea) | Task 3 |
| Repos posts extensions (listPosts DESC, generationJobId, listPostsWithIdea, getPostByGenerationJobId) | Task 4 |
| Sentinelle tenant isolation étendue | Task 5 |
| Queue `generate-post` + registry + enqueue | Task 6 |
| `/api/jobs/[id]` généralisé | Task 7 |
| `lintEditorial` | Task 8 |
| `buildSystemPrompt` + write/polish + generate composer | Task 9 |
| Worker `generate-post` + branchement + stub | Task 10 |
| Server Actions ideas (CRUD + enqueueGeneratePost) | Task 11 |
| Server Actions posts (update/delete) | Task 12 |
| shadcn components (select/card/badge/dialog) | Task 13 |
| Hook `useJobPolling` | Task 14 |
| Page `/ideas` + form + empty state | Task 15 |
| `IdeaCard` édition inline + génération | Task 16 |
| Page `/posts` (liste + join idea) | Task 17 |
| Page `/posts/[id]` (édition + valider + delete) | Task 18 |
| Sidebar Idées/Posts | Task 19 |
| Tests E2E /ideas | Task 20 |
| Tests E2E /posts | Task 21 |
| Vérification finale + cleanup | Task 22 |
| Helper `requireUserId` + dépendance Anthropic + env | Task 1 |

**Placeholder scan :** aucun "TBD"/"TODO"/"similar to Task N". Les blocs de code sont complets. Les commandes shell ont leur output attendu. Les commits ont leur message rédigé.

**Type consistency :**
- `Idea` : `{ id, userId, idea, brief, createdAt, updatedAt }` — cohérent.
- `Post` : `{ id, userId, ideaId, writingTemplateId, mediaId, content, status, generationJobId, createdAt, updatedAt }` — cohérent (la colonne `generationJobId` ajoutée Task 2, utilisée Task 4, 10, 11).
- `ActionState` : importé depuis `ideas/actions-core` par `posts/actions.ts` (Task 12) — cohérent.
- `GeneratePostJob` / `GeneratePostResult` : définis Task 6 (`client.ts`), utilisés Task 10 (worker).
- `GenerateFn` : défini Task 9, injecté Task 10.
- Hook `useJobPolling` (Task 14) attend `result: unknown`, le worker (Task 10) retourne `{ postId }` ; le toast dans le hook narrow via `'postId' in result` — cohérent.
- `jobKey` : généré par `enqueueGeneratePostCore` (Task 11), retourné via `enqueueGeneratePostAction` (Task 11) à `IdeaCard` (Task 16), passé à `useJobPolling` (Task 14), utilisé comme `jobId` BullMQ (Task 6) et comme idempotency key (Task 10). Chain complet.

**Cross-checks réalisés :**
- Le pattern wrapper/core est cohérent avec Spec 2/3 (vérifié via `cat src/app/(app)/settings/brand/actions.ts`).
- Les schemas exportent les types `Idea`, `Post`, `Voice`, `WritingTemplate` (vérifié dans `src/lib/db/schemas/`).
- `createTestUser` existe dans `test/integration/helpers/` (vérifié via `ls`).
- BullMQ `jobId` option dédup les jobs à l'enqueue (vérifié dans la doc BullMQ).

**Risques identifiés non bloquants :**
- Si shadcn `<Select>` n'a pas le bon mode contrôlé en React 19, fallback sur `<select>` natif HTML.
- Si Better-Auth `getSession` change de signature dans la prochaine version, mettre à jour `requireUserId`.
- Le pattern N+1 sur `/ideas` (un `listPostsByIdea` par idée) est acceptable jusqu'à ~100 ideas/user. À optimiser en Spec 8 si jamais on a un user atypique.

Plan complet et auto-suffisant. Un agent exécutant une task isolée a le code complet, les commandes exactes et les attentes claires.
