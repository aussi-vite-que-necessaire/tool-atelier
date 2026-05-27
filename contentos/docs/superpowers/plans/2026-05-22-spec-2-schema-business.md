# Spec 2 — Schema business + repositories + page Brand — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre la fondation v2 avec 5 tables métier (ideas, posts, publications, media, image_assets), leurs repositories CRUD scopés `user_id`, une page `/settings/brand` fonctionnelle, et un harness générique de tenant isolation.

**Architecture:** Schema Drizzle splitté en barrel + fichiers par domaine. cuid2 pour les IDs métier. CASCADE partout depuis `user` (sauf `posts.media_id` en SET NULL). Section `/settings/...` avec layout + sidebar shadcn. Server Action Brand refactoré en `wrapper (session) + core (logique)` pour testabilité integration. Sentinelle tenant via harness paramétré par fixture par table.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM 0.45, Postgres 16, Better-Auth 1.6, Vitest 3, Playwright, Tailwind v4, shadcn/ui (style base-nova), `@paralleldrive/cuid2`, sonner (à installer).

**Repo cible:** `/Users/ManuAVQN/Code/content-os-v2/` (le repo `content-os-v2`, branche `main`).

---

## Phase 1 — Foundations (refacto + dépendance)

### Task 1: Splitter schema.ts en barrel + fichiers par domaine

Pure refacto structurelle, zéro changement de comportement. Tous les tests existants continuent de passer.

**Files:**
- Create: `src/lib/db/schemas/auth.ts`
- Create: `src/lib/db/schemas/settings.ts`
- Modify: `src/lib/db/schema.ts` (devient un barrel)

- [ ] **Step 1: Créer `src/lib/db/schemas/auth.ts` avec les 4 tables Better-Auth**

```ts
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
```

- [ ] **Step 2: Créer `src/lib/db/schemas/settings.ts`**

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const settings = pgTable('settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull().default(''),
  brandColor: text('brand_color').notNull().default('#000000'),
  brandSignature: text('brand_signature').notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Settings = typeof settings.$inferSelect;
```

- [ ] **Step 3: Réécrire `src/lib/db/schema.ts` comme barrel**

```ts
export * from './schemas/auth';
export * from './schemas/settings';
```

- [ ] **Step 4: Vérifier que rien n'est cassé**

Run: `npm run lint && npm test`
Expected: tout vert (mêmes tests qu'avant).

- [ ] **Step 5: Vérifier que `drizzle-kit generate` ne produit pas de diff**

Run: `npm run db:generate`
Expected: aucun nouveau fichier dans `drizzle/`, output mentionne "No schema changes detected" ou équivalent.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/
git commit -m "🤖 refactor(db): split schema.ts en barrel + fichiers par domaine

Prépare l'ajout des schemas métier en éclatant l'unique fichier
schema.ts en un barrel qui re-exporte depuis schemas/auth.ts et
schemas/settings.ts. Aucun changement de comportement, tous les
imports externes (from '@/lib/db/schema') restent inchangés.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Installer cuid2 + helper de génération d'ID

**Files:**
- Modify: `package.json`
- Create: `src/lib/db/id.ts`

- [ ] **Step 1: Installer la dépendance**

Run: `npm install @paralleldrive/cuid2`
Expected: package installé, `package.json` et `package-lock.json` mis à jour.

- [ ] **Step 2: Créer `src/lib/db/id.ts`**

```ts
import { createId as cuid2 } from '@paralleldrive/cuid2';

export function createId(): string {
  return cuid2();
}
```

- [ ] **Step 3: Vérifier le lint et le build TS**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/db/id.ts
git commit -m "🤖 chore(db): install cuid2 + helper createId

Génération d'IDs côté app pour les futures tables métier
(ideas, posts, publications, media, image_assets). Indirection
via id.ts pour pouvoir swapper plus tard sans toucher 5 repos.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 2 — Schémas Drizzle

### Task 3: Schema `ideas`

**Files:**
- Create: `src/lib/db/schemas/ideas.ts`
- Modify: `src/lib/db/schema.ts` (ajouter l'export)

- [ ] **Step 1: Créer `src/lib/db/schemas/ideas.ts`**

```ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const ideas = pgTable(
  'ideas',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    idea: text('idea').notNull(),
    brief: text('brief'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ideas_user_id_idx').on(table.userId)],
);

export type Idea = typeof ideas.$inferSelect;
```

- [ ] **Step 2: Ajouter l'export dans le barrel**

Dans `src/lib/db/schema.ts`, ajouter à la fin :

```ts
export * from './schemas/ideas';
```

- [ ] **Step 3: Vérifier que TS compile**

Run: `npm run lint`
Expected: vert.

(Pas de commit séparé pour cette task — on commit après le bloc schema/migration global, Task 7.)

---

### Task 4: Schema `posts` + enum `post_status`

**Files:**
- Create: `src/lib/db/schemas/posts.ts`
- Modify: `src/lib/db/schema.ts` (ajouter l'export)

- [ ] **Step 1: Créer `src/lib/db/schemas/posts.ts`**

Note : on référence `ideas` (existe) et `media` (n'existe pas encore — sera ajouté Task 5). Pour l'instant, déclarer la FK media via le nom de table en string brut **n'est pas possible** en Drizzle classique. Donc on déclare `mediaId` comme `text` nullable sans `.references()`, et on ajoutera la `.references(() => media.id, { onDelete: 'set null' })` dans Task 5 quand `media` sera défini. **À ne pas oublier.**

Idem `writingTemplateId` qui reste sans `.references()` (Spec 3 ajoutera la contrainte via migration additive).

```ts
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { ideas } from './ideas';

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
    mediaId: text('media_id'), // FK ajoutée dans Task 5 après création de media
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
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

- [ ] **Step 2: Ajouter l'export dans le barrel**

Dans `src/lib/db/schema.ts`, ajouter :

```ts
export * from './schemas/posts';
```

- [ ] **Step 3: Vérifier que TS compile**

Run: `npm run lint`
Expected: vert.

---

### Task 5: Schema `media` + `image_assets` + enums `media_kind`, `image_source` + FK back-link sur `posts`

**Files:**
- Create: `src/lib/db/schemas/media.ts`
- Modify: `src/lib/db/schemas/posts.ts` (ajouter la FK `mediaId → media.id`)
- Modify: `src/lib/db/schema.ts` (ajouter l'export)

- [ ] **Step 1: Créer `src/lib/db/schemas/media.ts`**

```ts
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const mediaKind = pgEnum('media_kind', ['image', 'carousel', 'video']);
export const imageSource = pgEnum('image_source', ['template', 'standalone']);

export const media = pgTable(
  'media',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: mediaKind('kind').notNull(),
    assetKey: text('asset_key').notNull(),
    previewKey: text('preview_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('media_user_id_idx').on(table.userId)],
);

export const imageAssets = pgTable('image_assets', {
  mediaId: text('media_id')
    .primaryKey()
    .references(() => media.id, { onDelete: 'cascade' }),
  source: imageSource('source').notNull(),
  templateSlug: text('template_slug'),
  vars: jsonb('vars'),
  aiBrief: text('ai_brief'),
  aiSourceKey: text('ai_source_key'),
  styleId: text('style_id'), // FK ajoutée en Spec 3
});

export type Media = typeof media.$inferSelect;
export type ImageAsset = typeof imageAssets.$inferSelect;
```

- [ ] **Step 2: Ajouter la FK `mediaId` dans posts.ts**

Modifier `src/lib/db/schemas/posts.ts` :

Remplacer en haut du fichier :
```ts
import { user } from './auth';
import { ideas } from './ideas';
```
par :
```ts
import { user } from './auth';
import { ideas } from './ideas';
import { media } from './media';
```

Remplacer la définition de `mediaId` (`mediaId: text('media_id'),`) par :
```ts
mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
```

- [ ] **Step 3: Ajouter l'export dans le barrel**

Dans `src/lib/db/schema.ts`, ajouter :

```ts
export * from './schemas/media';
```

- [ ] **Step 4: Vérifier que TS compile**

Run: `npm run lint`
Expected: vert.

---

### Task 6: Schema `publications` + enum `publication_status`

**Files:**
- Create: `src/lib/db/schemas/publications.ts`
- Modify: `src/lib/db/schema.ts` (ajouter l'export)

- [ ] **Step 1: Créer `src/lib/db/schemas/publications.ts`**

```ts
import { index, integer, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { mediaKind } from './media';
import { posts } from './posts';

export const publicationStatus = pgEnum('publication_status', [
  'scheduled',
  'queued',
  'publishing',
  'published',
  'failed',
]);

export const publications = pgTable(
  'publications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    contentSnapshot: text('content_snapshot').notNull(),
    mediaKind: mediaKind('media_kind'),
    snapshotKeys: text('snapshot_keys').array(),
    socialAccountId: text('social_account_id'), // FK ajoutée en Spec 6
    platform: text('platform').notNull(),
    status: publicationStatus('status').notNull().default('scheduled'),
    scheduledFor: timestamp('scheduled_for'),
    scheduledTz: text('scheduled_tz'),
    publishedAt: timestamp('published_at'),
    externalPostId: text('external_post_id'),
    externalUrl: text('external_url'),
    attempts: integer('attempts').notNull().default(0),
    lastAttemptAt: timestamp('last_attempt_at'),
    nextAttemptAt: timestamp('next_attempt_at'),
    failureKind: text('failure_kind'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('publications_user_id_idx').on(table.userId),
    index('publications_post_id_idx').on(table.postId),
  ],
);

export type Publication = typeof publications.$inferSelect;
```

- [ ] **Step 2: Ajouter l'export dans le barrel**

Dans `src/lib/db/schema.ts`, ajouter :

```ts
export * from './schemas/publications';
```

- [ ] **Step 3: Vérifier que TS compile**

Run: `npm run lint`
Expected: vert.

---

### Task 7: Générer et appliquer la migration + étendre setup-integration

**Files:**
- Create: `drizzle/0001_*.sql` (nom auto-généré par drizzle-kit)
- Create: `drizzle/meta/0001_snapshot.json` + entry dans `drizzle/meta/_journal.json`
- Modify: `test/setup-integration.ts` (truncate les nouvelles tables avant chaque test)

- [ ] **Step 1: Démarrer la stack docker dev (postgres + redis) si pas déjà up**

Run: `docker compose up -d`
Expected: services postgres et redis healthy.

- [ ] **Step 2: Générer la migration**

Run: `npm run db:generate`
Expected: création d'un fichier `drizzle/0001_*.sql` qui contient :
- `CREATE TYPE post_status AS ENUM ('draft', 'validated');`
- `CREATE TYPE publication_status AS ENUM ('scheduled', 'queued', 'publishing', 'published', 'failed');`
- `CREATE TYPE media_kind AS ENUM ('image', 'carousel', 'video');`
- `CREATE TYPE image_source AS ENUM ('template', 'standalone');`
- Les 5 `CREATE TABLE`.
- Les `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...` (CASCADE partout sauf `posts_media_id` en SET NULL).
- Les `CREATE INDEX` (ideas_user_id_idx, posts_user_id_idx, posts_idea_id_idx, posts_media_id_idx, publications_user_id_idx, publications_post_id_idx, media_user_id_idx).

Inspecter le fichier généré pour valider qu'il contient bien tout ça avant de continuer.

- [ ] **Step 3: Appliquer la migration**

Run: `npm run db:migrate`
Expected: la migration s'applique sans erreur. Verify en se connectant à la DB et en faisant `\dt` ou via `npm run db:studio` que les 5 nouvelles tables existent.

- [ ] **Step 4: Modifier `test/setup-integration.ts` pour truncate les nouvelles tables**

Remplacer le contenu par :

```ts
import { beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import {
  account,
  imageAssets,
  ideas,
  media,
  posts,
  publications,
  session,
  settings,
  user,
  verification,
} from '@/lib/db/schema';

// Reset complet de la DB avant chaque test integration/worker pour isolation.
// L'ordre respecte les FK : on supprime les tables référençantes avant les référencées.
beforeEach(async () => {
  await db.delete(imageAssets);
  await db.delete(publications);
  await db.delete(posts);
  await db.delete(media);
  await db.delete(ideas);
  await db.delete(settings);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
});
```

- [ ] **Step 5: Vérifier que les tests existants passent toujours**

Run: `npm test`
Expected: vert (les tests de Spec 1 continuent de passer, aucun nouveau test).

- [ ] **Step 6: Vérifier qu'un nouveau `db:generate` ne produit aucun diff**

Run: `npm run db:generate`
Expected: "No schema changes detected" ou équivalent — pas de nouveau fichier dans `drizzle/`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/ drizzle/ test/setup-integration.ts
git commit -m "🤖 feat(db): schemas + migration business (ideas, posts, publications, media, image_assets)

Crée les 5 tables métier de Spec 2 avec leurs enums (post_status,
publication_status, media_kind, image_source) et leurs index. FK
ON DELETE CASCADE partout depuis user, sauf posts.media_id en SET
NULL. Étend setup-integration.ts pour truncate les nouvelles tables
entre tests.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 3 — Repositories CRUD (TDD)

Pattern uniforme appliqué dans les 5 tasks suivantes :
1. Écrire un fichier de test integration avec les 5 (ou 4 pour image_assets) cas happy path.
2. Lancer les tests, observer le RED ("module not found" ou similaire).
3. Implémenter le repository.
4. Lancer les tests, observer le GREEN.
5. Commit.

### Task 8: Repository `ideas` (TDD)

**Files:**
- Create: `test/integration/ideas-repository.test.ts`
- Create: `src/lib/db/repositories/ideas.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/ideas-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createIdea,
  deleteIdea,
  getIdea,
  listIdeas,
  updateIdea,
} from '@/lib/db/repositories/ideas';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('ideas repository', () => {
  test('createIdea insère une row avec id généré', async () => {
    await makeUser('u1', 'a@test.com');
    const idea = await createIdea('u1', { idea: 'concept' });
    expect(idea.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(idea.userId).toBe('u1');
    expect(idea.idea).toBe('concept');
    expect(idea.brief).toBeNull();
  });

  test('getIdea retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'concept', brief: 'detail' });
    const found = await getIdea('u1', created.id);
    expect(found?.idea).toBe('concept');
    expect(found?.brief).toBe('detail');
  });

  test('listIdeas retourne toutes les ideas du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createIdea('u1', { idea: 'first' });
    await createIdea('u1', { idea: 'second' });
    const rows = await listIdeas('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateIdea modifie les champs + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'old' });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateIdea('u1', created.id, { idea: 'new', brief: 'added' });
    expect(updated?.idea).toBe('new');
    expect(updated?.brief).toBe('added');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteIdea supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createIdea('u1', { idea: 'doomed' });
    await deleteIdea('u1', created.id);
    expect(await getIdea('u1', created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- ideas-repository`
Expected: erreur de résolution de module ou tests failed parce que `src/lib/db/repositories/ideas.ts` n'existe pas.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/ideas.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Idea, ideas } from '../schema';

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
  return db.select().from(ideas).where(eq(ideas.userId, userId));
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
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- ideas-repository`
Expected: 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/ideas-repository.test.ts src/lib/db/repositories/ideas.ts
git commit -m "🤖 feat(db): repository ideas CRUD scopé user_id

5 fonctions (create, get, list, update, delete) avec WHERE
user_id = \$userId systématique. updated_at réinjecté côté code
sur update. Tests integration happy path par fonction.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Repository `posts` (TDD)

**Files:**
- Create: `test/integration/posts-repository.test.ts`
- Create: `src/lib/db/repositories/posts.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/posts-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createIdea } from '@/lib/db/repositories/ideas';
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '@/lib/db/repositories/posts';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

async function makeIdeaForUser(userId: string): Promise<string> {
  const idea = await createIdea(userId, { idea: 'parent' });
  return idea.id;
}

describe('posts repository', () => {
  test('createPost insère une row avec defaults', async () => {
    await makeUser('u1', 'a@test.com');
    const ideaId = await makeIdeaForUser('u1');
    const post = await createPost('u1', { ideaId, content: 'draft text' });
    expect(post.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(post.userId).toBe('u1');
    expect(post.ideaId).toBe(ideaId);
    expect(post.content).toBe('draft text');
    expect(post.status).toBe('draft');
    expect(post.mediaId).toBeNull();
    expect(post.writingTemplateId).toBeNull();
  });

  test('getPost retourne la row pour le bon user', async () => {
    await makeUser('u1', 'a@test.com');
    const ideaId = await makeIdeaForUser('u1');
    const created = await createPost('u1', { ideaId, content: 'x' });
    const found = await getPost('u1', created.id);
    expect(found?.content).toBe('x');
  });

  test('listPosts retourne tous les posts du user', async () => {
    await makeUser('u1', 'a@test.com');
    const ideaId = await makeIdeaForUser('u1');
    await createPost('u1', { ideaId, content: 'a' });
    await createPost('u1', { ideaId, content: 'b' });
    const rows = await listPosts('u1');
    expect(rows).toHaveLength(2);
  });

  test('updatePost modifie content et status', async () => {
    await makeUser('u1', 'a@test.com');
    const ideaId = await makeIdeaForUser('u1');
    const created = await createPost('u1', { ideaId, content: 'old' });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePost('u1', created.id, {
      content: 'new',
      status: 'validated',
    });
    expect(updated?.content).toBe('new');
    expect(updated?.status).toBe('validated');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePost supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const ideaId = await makeIdeaForUser('u1');
    const created = await createPost('u1', { ideaId, content: 'doomed' });
    await deletePost('u1', created.id);
    expect(await getPost('u1', created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- posts-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/posts.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Post, posts } from '../schema';

export type CreatePostInput = {
  ideaId: string;
  content: string;
  writingTemplateId?: string | null;
  mediaId?: string | null;
  status?: 'draft' | 'validated';
};

export type UpdatePostPatch = Partial<{
  content: string;
  status: 'draft' | 'validated';
  writingTemplateId: string | null;
  mediaId: string | null;
}>;

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
  return db.select().from(posts).where(eq(posts.userId, userId));
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
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- posts-repository`
Expected: 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/posts-repository.test.ts src/lib/db/repositories/posts.ts
git commit -m "🤖 feat(db): repository posts CRUD scopé user_id

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Repository `media` (TDD)

**Files:**
- Create: `test/integration/media-repository.test.ts`
- Create: `src/lib/db/repositories/media.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/media-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from '@/lib/db/repositories/media';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  kind: 'image' as const,
  assetKey: 'media/u1/abc.png',
  previewKey: 'media/u1/abc.png',
  width: 1080,
  height: 1350,
};

describe('media repository', () => {
  test('createMedia insère une row image', async () => {
    await makeUser('u1', 'a@test.com');
    const m = await createMedia('u1', SAMPLE);
    expect(m.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(m.userId).toBe('u1');
    expect(m.kind).toBe('image');
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1350);
  });

  test('getMedia retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    const found = await getMedia('u1', created.id);
    expect(found?.assetKey).toBe(SAMPLE.assetKey);
  });

  test('listMedia retourne tous les media du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createMedia('u1', SAMPLE);
    await createMedia('u1', { ...SAMPLE, assetKey: 'media/u1/def.png' });
    const rows = await listMedia('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateMedia modifie les champs + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateMedia('u1', created.id, { width: 2160, height: 2700 });
    expect(updated?.width).toBe(2160);
    expect(updated?.height).toBe(2700);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteMedia supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    await deleteMedia('u1', created.id);
    expect(await getMedia('u1', created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- media-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/media.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Media, media } from '../schema';

export type CreateMediaInput = {
  kind: 'image' | 'carousel' | 'video';
  assetKey: string;
  previewKey: string;
  width: number;
  height: number;
};

export type UpdateMediaPatch = Partial<Omit<CreateMediaInput, 'kind'>>;

export async function createMedia(userId: string, data: CreateMediaInput): Promise<Media> {
  const id = createId();
  const [row] = await db.insert(media).values({ id, userId, ...data }).returning();
  return row!;
}

export async function getMedia(userId: string, id: string): Promise<Media | undefined> {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listMedia(userId: string): Promise<Media[]> {
  return db.select().from(media).where(eq(media.userId, userId));
}

export async function updateMedia(
  userId: string,
  id: string,
  patch: UpdateMediaPatch,
): Promise<Media | undefined> {
  const rows = await db
    .update(media)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(media.id, id), eq(media.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteMedia(userId: string, id: string): Promise<void> {
  await db.delete(media).where(and(eq(media.id, id), eq(media.userId, userId)));
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- media-repository`
Expected: 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/media-repository.test.ts src/lib/db/repositories/media.ts
git commit -m "🤖 feat(db): repository media CRUD scopé user_id

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Repository `image_assets` (TDD)

Pas de `listImageAssets` (sidecar one-to-one). 4 fonctions au lieu de 5. Scoping par join interne sur `media.user_id` (pas de colonne `user_id` sur `image_assets`).

**Files:**
- Create: `test/integration/image-assets-repository.test.ts`
- Create: `src/lib/db/repositories/image-assets.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/image-assets-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createImageAsset,
  deleteImageAsset,
  getImageAsset,
  updateImageAsset,
} from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

async function makeMediaForUser(userId: string): Promise<string> {
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: 'k',
    previewKey: 'k',
    width: 1080,
    height: 1080,
  });
  return m.id;
}

describe('image_assets repository', () => {
  test('createImageAsset insère une row standalone', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    const asset = await createImageAsset('u1', { mediaId, source: 'standalone' });
    expect(asset.mediaId).toBe(mediaId);
    expect(asset.source).toBe('standalone');
    expect(asset.templateSlug).toBeNull();
    expect(asset.vars).toBeNull();
  });

  test('createImageAsset insère une row template avec vars', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    const asset = await createImageAsset('u1', {
      mediaId,
      source: 'template',
      templateSlug: 'linkedin-quote',
      vars: { title: 'hello' },
      aiBrief: 'a quote layout',
    });
    expect(asset.source).toBe('template');
    expect(asset.templateSlug).toBe('linkedin-quote');
    expect(asset.vars).toEqual({ title: 'hello' });
    expect(asset.aiBrief).toBe('a quote layout');
  });

  test('getImageAsset retourne la row si le media appartient au user', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    const found = await getImageAsset('u1', mediaId);
    expect(found?.source).toBe('standalone');
  });

  test('updateImageAsset modifie les champs', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    const updated = await updateImageAsset('u1', mediaId, {
      aiBrief: 'new brief',
      vars: { title: 'changed' },
    });
    expect(updated?.aiBrief).toBe('new brief');
    expect(updated?.vars).toEqual({ title: 'changed' });
  });

  test('deleteImageAsset supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const mediaId = await makeMediaForUser('u1');
    await createImageAsset('u1', { mediaId, source: 'standalone' });
    await deleteImageAsset('u1', mediaId);
    expect(await getImageAsset('u1', mediaId)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- image-assets-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/image-assets.ts`**

```ts
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { type ImageAsset, imageAssets, media } from '../schema';

export type CreateImageAssetInput = {
  mediaId: string;
  source: 'template' | 'standalone';
  templateSlug?: string | null;
  vars?: unknown;
  aiBrief?: string | null;
  aiSourceKey?: string | null;
  styleId?: string | null;
};

export type UpdateImageAssetPatch = Partial<Omit<CreateImageAssetInput, 'mediaId'>>;

// Helper : sous-requête des media_ids qui appartiennent au user.
// Utilisé pour scoper toutes les ops de image_assets sans colonne user_id directe.
function ownedMediaIds(userId: string) {
  return db.select({ id: media.id }).from(media).where(eq(media.userId, userId));
}

export async function createImageAsset(
  userId: string,
  data: CreateImageAssetInput,
): Promise<ImageAsset> {
  // Vérifier que le media appartient bien au user avant d'insérer (sinon
  // FK passerait mais on créerait un image_assets pour un media d'un autre user).
  const owned = await db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.id, data.mediaId), eq(media.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    throw new Error('media not found or not owned by user');
  }

  const [row] = await db
    .insert(imageAssets)
    .values({
      mediaId: data.mediaId,
      source: data.source,
      templateSlug: data.templateSlug ?? null,
      vars: data.vars ?? null,
      aiBrief: data.aiBrief ?? null,
      aiSourceKey: data.aiSourceKey ?? null,
      styleId: data.styleId ?? null,
    })
    .returning();
  return row!;
}

export async function getImageAsset(
  userId: string,
  mediaId: string,
): Promise<ImageAsset | undefined> {
  const rows = await db
    .select()
    .from(imageAssets)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    )
    .limit(1);
  return rows[0];
}

export async function updateImageAsset(
  userId: string,
  mediaId: string,
  patch: UpdateImageAssetPatch,
): Promise<ImageAsset | undefined> {
  const rows = await db
    .update(imageAssets)
    .set(patch)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    )
    .returning();
  return rows[0];
}

export async function deleteImageAsset(userId: string, mediaId: string): Promise<void> {
  await db
    .delete(imageAssets)
    .where(
      and(eq(imageAssets.mediaId, mediaId), inArray(imageAssets.mediaId, ownedMediaIds(userId))),
    );
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- image-assets-repository`
Expected: 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/image-assets-repository.test.ts src/lib/db/repositories/image-assets.ts
git commit -m "🤖 feat(db): repository image_assets scopé via join media.user_id

4 fonctions (create, get, update, delete — pas de list, sidecar
one-to-one). Scoping passe par une sous-requête sur media.user_id
puisque la table image_assets n'a pas de colonne user_id directe.
createImageAsset valide en amont que le media cible appartient
au user.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Repository `publications` (TDD)

**Files:**
- Create: `test/integration/publications-repository.test.ts`
- Create: `src/lib/db/repositories/publications.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/publications-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getPublication,
  listPublications,
  updatePublication,
} from '@/lib/db/repositories/publications';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

async function makePostForUser(userId: string): Promise<string> {
  const idea = await createIdea(userId, { idea: 'parent' });
  const post = await createPost(userId, { ideaId: idea.id, content: 'final' });
  return post.id;
}

describe('publications repository', () => {
  test('createPublication insère avec defaults', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const pub = await createPublication('u1', {
      postId,
      contentSnapshot: 'snapshot content',
      platform: 'linkedin',
    });
    expect(pub.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(pub.userId).toBe('u1');
    expect(pub.postId).toBe(postId);
    expect(pub.contentSnapshot).toBe('snapshot content');
    expect(pub.platform).toBe('linkedin');
    expect(pub.status).toBe('scheduled');
    expect(pub.attempts).toBe(0);
  });

  test('getPublication retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    const found = await getPublication('u1', created.id);
    expect(found?.contentSnapshot).toBe('s');
  });

  test('listPublications retourne toutes les publications du user', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    await createPublication('u1', { postId, contentSnapshot: 'a', platform: 'linkedin' });
    await createPublication('u1', { postId, contentSnapshot: 'b', platform: 'linkedin' });
    const rows = await listPublications('u1');
    expect(rows).toHaveLength(2);
  });

  test('updatePublication modifie le cycle de vie', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePublication('u1', created.id, {
      status: 'queued',
      attempts: 1,
      lastError: 'noop',
    });
    expect(updated?.status).toBe('queued');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('noop');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePublication supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const postId = await makePostForUser('u1');
    const created = await createPublication('u1', {
      postId,
      contentSnapshot: 's',
      platform: 'linkedin',
    });
    await deletePublication('u1', created.id);
    expect(await getPublication('u1', created.id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- publications-repository`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/lib/db/repositories/publications.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type Publication, publications } from '../schema';

type PublicationStatus = 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed';
type MediaKindValue = 'image' | 'carousel' | 'video';

export type CreatePublicationInput = {
  postId: string;
  contentSnapshot: string;
  platform: string;
  mediaKind?: MediaKindValue | null;
  snapshotKeys?: string[] | null;
  socialAccountId?: string | null;
  status?: PublicationStatus;
  scheduledFor?: Date | null;
  scheduledTz?: string | null;
};

export type UpdatePublicationPatch = Partial<{
  status: PublicationStatus;
  scheduledFor: Date | null;
  scheduledTz: string | null;
  publishedAt: Date | null;
  externalPostId: string | null;
  externalUrl: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  failureKind: string | null;
  lastError: string | null;
  socialAccountId: string | null;
  contentSnapshot: string;
  mediaKind: MediaKindValue | null;
  snapshotKeys: string[] | null;
}>;

export async function createPublication(
  userId: string,
  data: CreatePublicationInput,
): Promise<Publication> {
  const id = createId();
  const [row] = await db
    .insert(publications)
    .values({
      id,
      userId,
      postId: data.postId,
      contentSnapshot: data.contentSnapshot,
      platform: data.platform,
      mediaKind: data.mediaKind ?? null,
      snapshotKeys: data.snapshotKeys ?? null,
      socialAccountId: data.socialAccountId ?? null,
      status: data.status ?? 'scheduled',
      scheduledFor: data.scheduledFor ?? null,
      scheduledTz: data.scheduledTz ?? null,
    })
    .returning();
  return row!;
}

export async function getPublication(
  userId: string,
  id: string,
): Promise<Publication | undefined> {
  const rows = await db
    .select()
    .from(publications)
    .where(and(eq(publications.id, id), eq(publications.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPublications(userId: string): Promise<Publication[]> {
  return db.select().from(publications).where(eq(publications.userId, userId));
}

export async function updatePublication(
  userId: string,
  id: string,
  patch: UpdatePublicationPatch,
): Promise<Publication | undefined> {
  const rows = await db
    .update(publications)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(publications.id, id), eq(publications.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePublication(userId: string, id: string): Promise<void> {
  await db
    .delete(publications)
    .where(and(eq(publications.id, id), eq(publications.userId, userId)));
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- publications-repository`
Expected: 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/publications-repository.test.ts src/lib/db/repositories/publications.ts
git commit -m "🤖 feat(db): repository publications CRUD scopé user_id

Update accepte un patch large couvrant tous les champs de cycle de
vie (status, scheduled_for, attempts, last_attempt_at, etc.) que
Spec 6 utilisera sans modifier ce repository.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 4 — Sentinelle tenant harness

### Task 13: Helper `createTestUser` + harness `tenant-isolation-harness.ts` (TDD via fixture `ideas`)

**Files:**
- Create: `test/integration/helpers/seed.ts`
- Create: `test/integration/helpers/tenant-isolation-harness.ts`
- Modify: `test/integration/tenant-isolation.test.ts` (ajout d'un appel `runTenantIsolationSuite('ideas', ...)`)

- [ ] **Step 1: Créer `test/integration/helpers/seed.ts`**

```ts
import { db } from '@/lib/db/client';
import { createId } from '@/lib/db/id';
import { user } from '@/lib/db/schema';

export async function createTestUser(label: string): Promise<string> {
  const id = createId();
  const email = `${label}-${id}@test.local`;
  await db.insert(user).values({ id, email });
  return id;
}
```

- [ ] **Step 2: Créer `test/integration/helpers/tenant-isolation-harness.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { createTestUser } from './seed';

export interface TenantIsolationFixture<TRow> {
  seed: (userId: string) => Promise<TRow>;
  rowId: (row: TRow) => string;
  reload: (userId: string, id: string) => Promise<TRow | undefined>;
  updatePatch: Record<string, unknown>;
  // Champs du patch dont on doit vérifier qu'ils n'ont PAS été appliqués cross-tenant.
  // Format : un sous-set de updatePatch utilisé pour assertion.
  updateAssertions?: (rowAfterCrossTenantUpdate: TRow) => void;

  get?: (userId: string, id: string) => Promise<TRow | undefined>;
  list?: (userId: string) => Promise<TRow[]>;
  update?: (
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ) => Promise<TRow | undefined>;
  delete?: (userId: string, id: string) => Promise<void>;
}

export function runTenantIsolationSuite<T>(
  name: string,
  fixture: TenantIsolationFixture<T>,
): void {
  describe(`${name} — tenant isolation`, () => {
    test('list: A et B ne voient que leurs propres rows', async () => {
      if (!fixture.list) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const rowB = await fixture.seed(b);
      const listA = await fixture.list(a);
      const listB = await fixture.list(b);
      expect(listA.map(fixture.rowId)).toEqual([fixture.rowId(rowA)]);
      expect(listB.map(fixture.rowId)).toEqual([fixture.rowId(rowB)]);
    });

    test('get cross-tenant retourne undefined', async () => {
      if (!fixture.get) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const stolen = await fixture.get(b, fixture.rowId(rowA));
      expect(stolen).toBeUndefined();
    });

    test('update cross-tenant est no-op', async () => {
      if (!fixture.update) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      const result = await fixture.update(b, fixture.rowId(rowA), fixture.updatePatch);
      expect(result).toBeUndefined();
      const reloaded = await fixture.reload(a, fixture.rowId(rowA));
      expect(reloaded).toBeDefined();
      if (fixture.updateAssertions && reloaded) {
        fixture.updateAssertions(reloaded);
      }
    });

    test('delete cross-tenant est no-op', async () => {
      if (!fixture.delete) return;
      const a = await createTestUser('alice');
      const b = await createTestUser('bob');
      const rowA = await fixture.seed(a);
      await fixture.delete(b, fixture.rowId(rowA));
      const reloaded = await fixture.reload(a, fixture.rowId(rowA));
      expect(reloaded).toBeDefined();
    });
  });
}
```

- [ ] **Step 3: Étendre `test/integration/tenant-isolation.test.ts` avec le premier appel (fixture ideas)**

Remplacer le contenu actuel du fichier par :

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createIdea,
  deleteIdea,
  getIdea,
  listIdeas,
  updateIdea,
} from '@/lib/db/repositories/ideas';
import { getSettings, updateSettings, upsertSettings } from '@/lib/db/repositories/settings';
import { user } from '@/lib/db/schema';
import { runTenantIsolationSuite } from './helpers/tenant-isolation-harness';

// Tests bespoke pour settings (singleton par user, pas de create/list/delete).
describe('settings — tenant isolation', () => {
  test('user A ne voit pas les settings de user B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertSettings('alice');
    await upsertSettings('bob');
    await updateSettings('alice', { brandName: 'AliceCorp' });
    await updateSettings('bob', { brandName: 'BobCorp' });

    const aliceSettings = await getSettings('alice');
    const bobSettings = await getSettings('bob');
    expect(aliceSettings?.brandName).toBe('AliceCorp');
    expect(bobSettings?.brandName).toBe('BobCorp');
  });

  test('updateSettings sur user A ne touche pas user B', async () => {
    await db.insert(user).values([
      { id: 'alice', email: 'alice@test.com' },
      { id: 'bob', email: 'bob@test.com' },
    ]);
    await upsertSettings('alice');
    await upsertSettings('bob');

    await updateSettings('alice', { brandName: 'ChangedByAlice' });
    const bob = await getSettings('bob');
    expect(bob?.brandName).toBe('');
  });
});

// Sentinelle générique pour les tables avec CRUD standard.
runTenantIsolationSuite('ideas', {
  seed: (uid) => createIdea(uid, { idea: 'sample' }),
  rowId: (r) => r.id,
  reload: (uid, id) => getIdea(uid, id),
  updatePatch: { idea: 'hacked' },
  updateAssertions: (row) => {
    expect(row.idea).toBe('sample');
  },
  get: getIdea,
  list: listIdeas,
  update: updateIdea,
  delete: deleteIdea,
});
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- tenant-isolation`
Expected: 2 tests settings (existants) + 4 tests ideas (du harness) = 6 tests verts.

- [ ] **Step 5: Commit**

```bash
git add test/integration/helpers/ test/integration/tenant-isolation.test.ts
git commit -m "🤖 test(integration): harness sentinelle tenant + fixture ideas

Helper createTestUser + harness paramétré runTenantIsolationSuite
qui génère 4 tests (list scoped, get cross-tenant undefined, update
cross-tenant no-op, delete cross-tenant no-op) à partir d'un
fixture par repository. Premier appel sur ideas pour valider le
pattern.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 14: Ajouter les 4 fixtures restants (posts, publications, media, image_assets)

**Files:**
- Modify: `test/integration/tenant-isolation.test.ts`

- [ ] **Step 1: Ajouter les imports en haut du fichier**

À la suite des imports existants dans `test/integration/tenant-isolation.test.ts` :

```ts
import {
  createImageAsset,
  deleteImageAsset,
  getImageAsset,
  updateImageAsset,
} from '@/lib/db/repositories/image-assets';
import {
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from '@/lib/db/repositories/media';
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getPublication,
  listPublications,
  updatePublication,
} from '@/lib/db/repositories/publications';
```

- [ ] **Step 2: Ajouter les 4 appels harness à la fin du fichier**

```ts
runTenantIsolationSuite('posts', {
  seed: async (uid) => {
    const idea = await createIdea(uid, { idea: 'parent' });
    return createPost(uid, { ideaId: idea.id, content: 'draft' });
  },
  rowId: (r) => r.id,
  reload: (uid, id) => getPost(uid, id),
  updatePatch: { content: 'hacked' },
  updateAssertions: (row) => {
    expect(row.content).toBe('draft');
  },
  get: getPost,
  list: listPosts,
  update: updatePost,
  delete: deletePost,
});

runTenantIsolationSuite('publications', {
  seed: async (uid) => {
    const idea = await createIdea(uid, { idea: 'parent' });
    const post = await createPost(uid, { ideaId: idea.id, content: 'final' });
    return createPublication(uid, {
      postId: post.id,
      contentSnapshot: 'snap',
      platform: 'linkedin',
    });
  },
  rowId: (r) => r.id,
  reload: (uid, id) => getPublication(uid, id),
  updatePatch: { contentSnapshot: 'hacked' },
  updateAssertions: (row) => {
    expect(row.contentSnapshot).toBe('snap');
  },
  get: getPublication,
  list: listPublications,
  update: updatePublication,
  delete: deletePublication,
});

runTenantIsolationSuite('media', {
  seed: (uid) =>
    createMedia(uid, {
      kind: 'image',
      assetKey: 'k',
      previewKey: 'k',
      width: 1080,
      height: 1080,
    }),
  rowId: (r) => r.id,
  reload: (uid, id) => getMedia(uid, id),
  updatePatch: { assetKey: 'hacked' },
  updateAssertions: (row) => {
    expect(row.assetKey).toBe('k');
  },
  get: getMedia,
  list: listMedia,
  update: updateMedia,
  delete: deleteMedia,
});

runTenantIsolationSuite('image_assets', {
  seed: async (uid) => {
    const m = await createMedia(uid, {
      kind: 'image',
      assetKey: 'k',
      previewKey: 'k',
      width: 1080,
      height: 1080,
    });
    return createImageAsset(uid, { mediaId: m.id, source: 'standalone', aiBrief: 'original' });
  },
  rowId: (r) => r.mediaId,
  reload: (uid, id) => getImageAsset(uid, id),
  updatePatch: { aiBrief: 'hacked' },
  updateAssertions: (row) => {
    expect(row.aiBrief).toBe('original');
  },
  get: getImageAsset,
  update: updateImageAsset,
  delete: deleteImageAsset,
  // pas de list pour image_assets
});
```

- [ ] **Step 3: Lancer toute la suite tenant-isolation**

Run: `npm run test:integration -- tenant-isolation`
Expected: 2 (settings bespoke) + 4 × 5 (4 tests par harness × 5 tables : ideas, posts, publications, media, image_assets) - 1 (image_assets n'a pas le test list) = 21 tests verts.

- [ ] **Step 4: Lancer toute la suite integration pour confirmer qu'aucune régression**

Run: `npm run test:integration`
Expected: tous verts (les 5 repository tests + tenant-isolation + settings-repository existant).

- [ ] **Step 5: Commit**

```bash
git add test/integration/tenant-isolation.test.ts
git commit -m "🤖 test(integration): sentinelle tenant pour posts, publications, media, image_assets

4 nouveaux appels au harness, un par table métier. image_assets
n'a pas de list (sidecar) donc 4 tests au lieu de 5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 5 — UI Brand

### Task 15: Installer sonner via shadcn + monter Toaster

**Files:**
- Modify: `package.json`
- Create: `src/components/ui/sonner.tsx` (généré par shadcn CLI)
- Modify: `src/app/(app)/layout.tsx` (ajouter `<Toaster />`)

- [ ] **Step 1: Ajouter sonner via la CLI shadcn**

Run: `npx shadcn@latest add sonner`
Expected: la CLI ajoute le composant `src/components/ui/sonner.tsx` et installe la dépendance `sonner` dans package.json.

- [ ] **Step 2: Vérifier que le composant est bien créé**

Run: `cat src/components/ui/sonner.tsx`
Expected: voir un composant `<Toaster>` exporté.

- [ ] **Step 3: Monter `<Toaster />` dans le layout (app)**

Modifier `src/app/(app)/layout.tsx` :

Ajouter l'import :
```ts
import { Toaster } from '@/components/ui/sonner';
```

Insérer `<Toaster />` juste avant la fermeture de `</div>` du root :

```tsx
  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader name={session.user.name ?? null} email={session.user.email} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
      <Toaster />
    </div>
  );
```

- [ ] **Step 4: Vérifier le lint + build**

Run: `npm run lint && npm run build`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/ui/sonner.tsx src/app/\(app\)/layout.tsx
git commit -m "🤖 feat(ui): install sonner + monte Toaster dans le layout app

Préparation des toasts de succès/erreur pour la page Brand.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 16: Installer shadcn Textarea (utilisé par le form Brand)

**Files:**
- Create: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Ajouter Textarea via la CLI shadcn**

Run: `npx shadcn@latest add textarea`
Expected: `src/components/ui/textarea.tsx` créé.

- [ ] **Step 2: Vérifier le lint**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/textarea.tsx
git commit -m "🤖 feat(ui): install shadcn Textarea

Pour le champ brand_signature de la page /settings/brand.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 17: Settings layout + sidebar + redirect /settings → /settings/brand

**Files:**
- Create: `src/app/(app)/settings/layout.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/components/settings/settings-sidebar.tsx`

- [ ] **Step 1: Créer le composant sidebar `src/components/settings/settings-sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Item = { label: string; href?: string };

const items: Item[] = [
  { label: 'Brand', href: '/settings/brand' },
  { label: 'Voix' },
  { label: "Templates d'écriture" },
  { label: 'Visual briefing' },
  { label: 'Visual styles' },
  { label: 'Clés API' },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Réglages" className="w-56 shrink-0 space-y-1">
      {items.map((item) => {
        const active = item.href ? pathname?.startsWith(item.href) : false;
        if (!item.href) {
          return (
            <span
              key={item.label}
              aria-disabled="true"
              className="block px-3 py-2 text-sm text-neutral-400 cursor-not-allowed"
            >
              {item.label}
              <span className="ml-1 text-xs">(à venir)</span>
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'block px-3 py-2 text-sm rounded-md',
              active
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-700 hover:bg-neutral-100',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Créer le layout `src/app/(app)/settings/layout.tsx`**

```tsx
import { SettingsSidebar } from '@/components/settings/settings-sidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8">
      <SettingsSidebar />
      <div className="flex-1 max-w-2xl">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Créer la page racine `src/app/(app)/settings/page.tsx` (redirect)**

```tsx
import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/settings/brand');
}
```

- [ ] **Step 4: Vérifier le lint + build**

Run: `npm run lint && npm run build`
Expected: vert.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/ src/components/settings/
git commit -m "🤖 feat(ui): section /settings/... avec layout sidebar

Sidebar shadcn avec 6 items (Brand actif, Voix/Templates/Visual
briefing/Visual styles/Clés API désactivés en attendant Specs 3+).
Redirect /settings → /settings/brand.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 18: Server Action Brand — core function + tests (TDD)

Approche : on splitte le Server Action en deux fichiers.
- `actions.ts` : Server Action public (lit la session, délègue au core).
- `actions-core.ts` : fonction pure qui prend `userId` + `FormData`, fait validation Zod + update DB. Testable en integration sans avoir à mocker la session.

**Files:**
- Create: `test/integration/settings-action.test.ts`
- Create: `src/app/(app)/settings/brand/actions-core.ts`

- [ ] **Step 1: Écrire le test integration (RED)**

`test/integration/settings-action.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { updateBrandSettingsCore } from '@/app/(app)/settings/brand/actions-core';
import { db } from '@/lib/db/client';
import { getSettings, upsertSettings } from '@/lib/db/repositories/settings';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
  await upsertSettings(id);
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('updateBrandSettingsCore', () => {
  test('success : met à jour les 3 champs et retourne success', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateBrandSettingsCore(
      'u1',
      fd({
        brand_name: 'Acme',
        brand_color: '#112233',
        brand_signature: 'Signed',
      }),
    );
    expect(result).toEqual({ status: 'success' });

    const settings = await getSettings('u1');
    expect(settings?.brandName).toBe('Acme');
    expect(settings?.brandColor).toBe('#112233');
    expect(settings?.brandSignature).toBe('Signed');
  });

  test('validation error : brand_color au mauvais format', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateBrandSettingsCore(
      'u1',
      fd({
        brand_name: 'Acme',
        brand_color: 'not-a-hex',
        brand_signature: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBe('validation');
      expect(result.fieldErrors?.brand_color).toBeDefined();
    }

    const settings = await getSettings('u1');
    expect(settings?.brandColor).toBe('#000000'); // default DB, pas modifié
  });

  test('validation error : brand_name trop long', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await updateBrandSettingsCore(
      'u1',
      fd({
        brand_name: 'x'.repeat(101),
        brand_color: '#000000',
        brand_signature: '',
      }),
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.fieldErrors?.brand_name).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Lancer les tests, observer le RED**

Run: `npm run test:integration -- settings-action`
Expected: erreur de résolution de module.

- [ ] **Step 3: Implémenter `src/app/(app)/settings/brand/actions-core.ts`**

```ts
import { z } from 'zod';
import { updateSettings } from '@/lib/db/repositories/settings';

export type BrandActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const brandSchema = z.object({
  brand_name: z.string().max(100),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  brand_signature: z.string().max(1000),
});

export async function updateBrandSettingsCore(
  userId: string,
  formData: FormData,
): Promise<BrandActionState> {
  const raw = {
    brand_name: String(formData.get('brand_name') ?? ''),
    brand_color: String(formData.get('brand_color') ?? ''),
    brand_signature: String(formData.get('brand_signature') ?? ''),
  };

  const parsed = brandSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateSettings(userId, {
    brandName: parsed.data.brand_name,
    brandColor: parsed.data.brand_color,
    brandSignature: parsed.data.brand_signature,
  });

  return { status: 'success' };
}
```

- [ ] **Step 4: Lancer les tests, observer le GREEN**

Run: `npm run test:integration -- settings-action`
Expected: 3 tests passent.

- [ ] **Step 5: Commit**

```bash
git add test/integration/settings-action.test.ts src/app/\(app\)/settings/brand/actions-core.ts
git commit -m "🤖 feat(settings): updateBrandSettingsCore + validation Zod

Fonction pure userId + FormData → BrandActionState. Validation
Zod sur brand_name (max 100), brand_color (regex hex), brand_signature
(max 1000). Délègue à updateSettings(userId, ...).

Le Server Action wrapper (avec session check) viendra dans la
prochaine task. La séparation core/wrapper permet de tester en
integration sans mocker la session.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 19: Server Action wrapper + page Brand + form

**Files:**
- Create: `src/app/(app)/settings/brand/actions.ts`
- Create: `src/app/(app)/settings/brand/page.tsx`
- Create: `src/app/(app)/settings/brand/brand-form.tsx`

- [ ] **Step 1: Créer `src/app/(app)/settings/brand/actions.ts` (wrapper)**

```ts
'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/server';
import { type BrandActionState, updateBrandSettingsCore } from './actions-core';

export async function updateBrandSettings(
  _prev: BrandActionState,
  formData: FormData,
): Promise<BrandActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { status: 'error', message: 'unauthenticated' };
  }
  const result = await updateBrandSettingsCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/brand');
  }
  return result;
}
```

- [ ] **Step 2: Créer `src/app/(app)/settings/brand/brand-form.tsx` (client component)**

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { type BrandActionState } from './actions-core';
import { updateBrandSettings } from './actions';

type Initial = {
  brandName: string;
  brandColor: string;
  brandSignature: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </Button>
  );
}

export function BrandForm({ initialValues }: { initialValues: Initial }) {
  const [state, formAction] = useActionState<BrandActionState, FormData>(updateBrandSettings, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Identité de marque mise à jour');
    } else if (state.status === 'error') {
      toast.error(
        state.message === 'validation' ? 'Champs invalides' : 'Erreur lors de la sauvegarde',
      );
    }
  }, [state]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="brand_name">Nom de marque</Label>
        <Input
          id="brand_name"
          name="brand_name"
          type="text"
          defaultValue={initialValues.brandName}
          maxLength={100}
        />
        {fieldErrors?.brand_name && (
          <p className="text-sm text-red-600">{fieldErrors.brand_name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand_color">Couleur principale</Label>
        <Input
          id="brand_color"
          name="brand_color"
          type="color"
          defaultValue={initialValues.brandColor}
          className="h-10 w-20 p-1"
        />
        {fieldErrors?.brand_color && (
          <p className="text-sm text-red-600">{fieldErrors.brand_color}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand_signature">Signature</Label>
        <Textarea
          id="brand_signature"
          name="brand_signature"
          defaultValue={initialValues.brandSignature}
          maxLength={1000}
          rows={3}
        />
        {fieldErrors?.brand_signature && (
          <p className="text-sm text-red-600">{fieldErrors.brand_signature}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Créer `src/app/(app)/settings/brand/page.tsx` (server component)**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getSettings } from '@/lib/db/repositories/settings';
import { BrandForm } from './brand-form';

export default async function BrandPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const settings = await getSettings(session.user.id);
  const initialValues = settings ?? {
    brandName: '',
    brandColor: '#000000',
    brandSignature: '',
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Identité de marque</h2>
        <p className="text-sm text-neutral-600">
          Ces valeurs servent de défauts aux templates et signatures.
        </p>
      </header>
      <BrandForm
        initialValues={{
          brandName: initialValues.brandName,
          brandColor: initialValues.brandColor,
          brandSignature: initialValues.brandSignature,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Vérifier le lint + build**

Run: `npm run lint && npm run build`
Expected: vert.

- [ ] **Step 5: Smoke test manuel (optionnel mais recommandé)**

Run: `npm run dev`

Dans un navigateur :
1. Aller sur `http://localhost:3000`, faire un signup magic link (récupérer le lien via `npm run dev` logs ou inbox).
2. Naviguer sur `/settings/brand`.
3. Remplir les 3 champs (ex: "Acme", `#ff0066`, "Acme — Signature").
4. Cliquer "Enregistrer".
5. Voir un toast de succès.
6. Recharger la page → les valeurs persistent, le color picker affiche `#ff0066`.

Si tout marche, passer à l'étape suivante.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/settings/brand/
git commit -m "🤖 feat(settings): page /settings/brand + Server Action wrapper

Server component qui lit la session + settings et passe initialValues
au BrandForm client. Le form utilise useActionState + useFormStatus
React 19, sonner pour les toasts. Wrapper Server Action fait la
session check puis délègue au core.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase 6 — E2E + verification finale

### Task 20: E2E Playwright pour `/settings/brand`

**Files:**
- Create: `test/e2e/settings-brand.spec.ts`

- [ ] **Step 1: Créer le fichier de test E2E**

`test/e2e/settings-brand.spec.ts` :

```ts
import { expect, type Page, test } from '@playwright/test';

const TEST_EMAIL = `playwright-brand-${Date.now()}@test.invalid`;

async function fetchMagicLink(page: Page, email: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Magic link not found');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Magic link email never arrived');
}

test.describe('Settings Brand', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/__test__/emails');
  });

  test('signup → /settings/brand → remplit form → submit → recharge → valeurs persistées', async ({
    page,
  }) => {
    // 1. Signup
    await page.goto('/signin');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/verify/);
    const magicUrl = await fetchMagicLink(page, TEST_EMAIL);
    await page.goto(magicUrl);
    await expect(page).toHaveURL('/');

    // 2. Aller sur /settings/brand
    await page.goto('/settings/brand');
    await expect(page.getByText('Identité de marque')).toBeVisible();

    // 3. Vérifier que la sidebar montre Brand actif
    await expect(page.getByRole('link', { name: 'Brand' })).toBeVisible();
    await expect(page.getByText("Voix")).toBeVisible();

    // 4. Remplir le form
    await page.fill('input[name="brand_name"]', 'AcmeCorp');
    await page.fill('input[name="brand_color"]', '#ff0066');
    await page.fill('textarea[name="brand_signature"]', 'AcmeCorp — Signature');

    // 5. Submit
    await page.click('button[type="submit"]');

    // 6. Attendre le toast de succès
    await expect(page.getByText('Identité de marque mise à jour')).toBeVisible({
      timeout: 5_000,
    });

    // 7. Recharger la page
    await page.reload();

    // 8. Vérifier que les valeurs persistent
    await expect(page.locator('input[name="brand_name"]')).toHaveValue('AcmeCorp');
    await expect(page.locator('input[name="brand_color"]')).toHaveValue('#ff0066');
    await expect(page.locator('textarea[name="brand_signature"]')).toHaveValue(
      'AcmeCorp — Signature',
    );
  });

  test('/settings redirige vers /settings/brand', async ({ page }) => {
    const email = `playwright-redirect-${Date.now()}@test.invalid`;

    // Signup complet pour ce test
    await page.goto('/signin');
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/verify/);
    const magicUrl = await fetchMagicLink(page, email);
    await page.goto(magicUrl);
    await expect(page).toHaveURL('/');

    // Tester le redirect
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings\/brand$/);
  });
});
```

- [ ] **Step 2: Build + lancer les E2E**

Run: `npm run build && npm run test:e2e`
Expected: l'auth E2E existant + les 2 nouveaux tests Brand passent.

Si le test "redirige vers /settings/brand" échoue à cause de fetchMagicLink (l'email du 2ème test est différent), simplifier en partageant la session via storage state ou faire 2 signups séparés avec leurs propres emails. Adapter au besoin.

- [ ] **Step 3: Commit**

```bash
git add test/e2e/settings-brand.spec.ts
git commit -m "🤖 test(e2e): /settings/brand flow complet + redirect /settings

Signup → /settings/brand → fill form → submit → reload → values
persisted. 2e test : /settings redirige vers /settings/brand.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 21: Verification finale + push

**Files:** aucun changement de code.

- [ ] **Step 1: Lancer le lint**

Run: `npm run lint`
Expected: vert.

- [ ] **Step 2: Lancer tous les tests (unit + integration + worker)**

Run: `npm test`
Expected: vert. Récap attendu :
- Unit : tests existants (email, storage)
- Integration : 5 repositories + tenant-isolation (21 tests) + settings-repository + settings-action (3 tests)
- Worker : test dummy existant

- [ ] **Step 3: Lancer les E2E**

Run: `npm run build && npm run test:e2e`
Expected: auth flow + 2 tests settings-brand verts.

- [ ] **Step 4: Vérifier que `db:generate` ne produit aucun diff**

Run: `npm run db:generate`
Expected: "No schema changes detected".

- [ ] **Step 5: Vérifier le statut git**

Run: `git status`
Expected: working tree clean.

- [ ] **Step 6: Vérifier le log des commits**

Run: `git log --oneline -25`
Expected: voir les commits de Spec 2 (refacto barrel, cuid2, schemas/migration, 5 repositories, harness, sonner, settings layout, brand action core, brand page, e2e).

- [ ] **Step 7: Push vers la remote**

Run: `git push origin main`
Expected: push réussi. La CI GitHub Actions devrait se lancer automatiquement et passer sur les 5 jobs (lint, unit, integration, worker, e2e).

- [ ] **Step 8: Attendre la CI**

Aller sur GitHub Actions de `content-os-v2` et vérifier que le run sur `main` passe entièrement vert. Si une étape échoue, fix locally + nouveau commit + nouveau push.

---

## Notes pour l'exécutant

- **Stack à démarrer** : avant chaque session de tests, lancer `docker compose up -d` dans le repo `content-os-v2` pour avoir postgres + redis up. La DB persiste entre sessions.
- **`drizzle-kit generate` vs migration manuelle** : on génère TOUJOURS les migrations via `drizzle-kit`. Si un diff inattendu apparaît, c'est un signal qu'on a divergé entre schema TS et état DB. Investigate avant de continuer.
- **Ordre des FK dans setup-integration.ts** : strict. Une table référencée ne peut pas être supprimée tant qu'une row la référence existe. Ordre actuel respecte la dépendance topologique des FK.
- **Image_assets et le scoping via join** : la sous-requête `ownedMediaIds(userId)` est ré-évaluée à chaque appel. Pour un volume gros, on optimisera en Spec 5+ ; ici pas critique (CRUD basique).
- **Toast attendu** : utiliser `toast.success(...)` de `sonner`, pas `useToast()` (ancien shadcn pattern). Le composant `<Toaster />` doit être monté une fois dans le layout `(app)`.
- **`useActionState` + `useFormStatus`** : React 19 natifs. Pas besoin de `react-hook-form`. Si TS rouspète sur les types de la signature `(prev, formData) => state`, ajuster le type générique `useActionState<BrandActionState, FormData>`.
- **Deviation du spec sur les tests d'action** : le spec mentionnait un test "unauthenticated" sur le Server Action. On a refactoré en `actions-core.ts` (testé en integration) + `actions.ts` (wrapper avec session check, couvert par E2E + middleware existant). Le cas "unauthenticated" du wrapper est trivialement vérifié par le middleware (redirect /signin avant même que l'action soit appelée).
