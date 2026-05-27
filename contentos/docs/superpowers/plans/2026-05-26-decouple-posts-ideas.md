# Découpler posts et idées — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le lien DB posts↔idées (`idea_id`) et le champ dormant `writing_template_id` ; donner au post un `title` obligatoire ; créer un post depuis `/posts` et le MCP ; l'idée redevient une note pure.

**Architecture:** Migration drizzle ordonnée (add `title` nullable → backfill depuis l'idée → NOT NULL → drop FK/index/`idea_id`/`writing_template_id`). Le schéma TS, les repositories, le tool MCP `create_post`, les server actions, l'UI posts/idées, le seed et le skill sont alignés sur le post autonome `{ title, content, status, media }`. Tous les appels `createPost` (source + tests) passent de `{ ideaId }` à `{ title }`.

**Tech Stack:** Next.js 16, Drizzle ORM (postgres), Zod, Vitest (unit/integration/worker), Playwright (e2e), Biome.

**Spec:** `docs/superpowers/specs/2026-05-26-spec-24-decouple-posts-ideas-design.md`

**Exécution :** inline (executing-plans). Le changement de type `Post`/`CreatePostInput` casse la compilation dans tout le repo ; l'ordre est donc : (1) schéma+migration, (2) source jusqu'à build vert, (3) sweeps de tests, (4) e2e, (5) vérif + PR. On commit à chaque tâche.

---

### Task 0: Branche de travail

- [ ] **Step 1: Créer la branche**

```bash
git switch -c decouple-posts-ideas
```

- [ ] **Step 2: Vérifier la base de test prête**

```bash
npm run db:test:prepare
```

Expected: `migrations OK` (base `contentos_test` à jour sur l'état actuel).

---

### Task 1: Schéma + migration

**Files:**
- Modify: `src/lib/db/schemas/posts.ts`
- Create: `drizzle/00NN_*.sql` (généré puis édité à la main pour le backfill)

- [ ] **Step 1: Réécrire le schéma posts (état cible)**

`src/lib/db/schemas/posts.ts` :

```ts
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { media } from './media';

export const postStatus = pgEnum('post_status', ['draft', 'validated']);

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    mediaId: text('media_id').references(() => media.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    status: postStatus('status').notNull().default('draft'),
    generationJobId: text('generation_job_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('posts_user_id_idx').on(table.userId),
    index('posts_media_id_idx').on(table.mediaId),
  ],
);

export type Post = typeof posts.$inferSelect;
```

(Retirés : import `ideas`, `ideaId`, `writingTemplateId`, index `posts_idea_id_idx`. Ajouté : `title`.)

- [ ] **Step 2: Générer la migration**

```bash
npm run db:generate
```

drizzle-kit voit en même temps un ajout (`title`) et deux drops de colonnes `text` (`idea_id`, `writing_template_id`) → il peut demander en interactif si `title` est un **rename**. Répondre que `title` est **créé** (`+`), et que `idea_id` / `writing_template_id` sont **supprimés** (`-`). Si l'invite n'est pas franchissable en non-interactif, faire en deux temps : d'abord générer avec `title` nullable seul (additif, sans drop → aucune invite), puis re-générer avec l'état cible (drops + NOT NULL, sans nouvelle colonne → aucune invite). Le snapshot `meta/00NN_snapshot.json` reste celui produit par drizzle.

- [ ] **Step 3: Réécrire le corps SQL généré (backfill ordonné)**

Remplacer le contenu du `.sql` généré par :

```sql
ALTER TABLE "posts" ADD COLUMN "title" text;--> statement-breakpoint
UPDATE "posts" SET "title" = COALESCE((SELECT "idea" FROM "ideas" WHERE "ideas"."id" = "posts"."idea_id"), 'Sans titre');--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_idea_id_ideas_id_fk";--> statement-breakpoint
DROP INDEX "posts_idea_id_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "idea_id";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN "writing_template_id";
```

(`COALESCE … 'Sans titre'` est défensif ; tous les posts existants ont un `idea_id` NOT NULL valide, donc le sous-select renvoie toujours le titre de l'idée.)

- [ ] **Step 4: Appliquer à la base de test et vérifier**

```bash
npm run db:test:prepare
```

Expected: `migrations OK`. Vérifier ensuite la forme de la table :

```bash
psql "$DATABASE_URL_TEST" -c '\d posts' 2>/dev/null || echo "vérif via test d'intégration à la Task 2"
```

Expected: colonne `title text not null`, **aucune** colonne `idea_id` ni `writing_template_id`, plus d'index `posts_idea_id_idx`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schemas/posts.ts drizzle/
git commit -m "🤖 feat(spec-24): drop idea_id + writing_template_id, add title NOT NULL (migration backfill)"
```

---

### Task 2: Repositories

**Files:**
- Modify: `src/lib/db/repositories/posts.ts`
- Modify: `src/lib/db/repositories/ideas.ts`
- Test: `test/integration/posts-repository.test.ts`, `test/integration/ideas-repository.test.ts`

- [ ] **Step 1: Mettre à jour `repositories/posts.ts`**

- Import : `import { and, desc, eq } from 'drizzle-orm';` puis `import { type Post, posts } from '../schema';` (retirer `type Idea, ideas`).
- `CreatePostInput` :

```ts
export type CreatePostInput = {
  title: string;
  content: string;
  mediaId?: string | null;
  status?: 'draft' | 'validated';
  generationJobId?: string | null;
};
```

- `UpdatePostPatch` :

```ts
export type UpdatePostPatch = Partial<{
  title: string;
  content: string;
  status: 'draft' | 'validated';
  mediaId: string | null;
}>;
```

- `createPost` insère `title: data.title` à la place de `ideaId`/`writingTemplateId`.
- Supprimer le type `PostWithIdea` et la fonction `listPostsWithIdea`.

- [ ] **Step 2: Mettre à jour `repositories/ideas.ts`**

- Supprimer `listPostsByIdea` et `countPostsByIdea`.
- Import : `import { and, desc, eq } from 'drizzle-orm';` et `import { type Idea, ideas } from '../schema';` (retirer `count`, `posts`, `Post`).

- [ ] **Step 3: Mettre à jour les tests repo**

`test/integration/posts-repository.test.ts` :
- Retirer l'import et le `describe('listPostsWithIdea')`.
- Supprimer le helper `makeIdeaForUser` ; remplacer chaque `const ideaId = await makeIdeaForUser(...)` + `createPost('u1', { ideaId, content })` par `createPost('u1', { title: 'T', content })`.
- Dans `createPost insère une row avec defaults` : retirer `expect(post.ideaId)` et `expect(post.writingTemplateId)`, ajouter `expect(post.title).toBe('T')`.
- Dans les describes `listPosts ordering` et `getPostByGenerationJobId` : remplacer `createIdea` + `{ ideaId: idea.id, ... }` par `{ title: 'T', ... }` (retirer les `createIdea` devenus inutiles).

`test/integration/ideas-repository.test.ts` :
- Retirer les imports `listPostsByIdea`, `countPostsByIdea` et leur(s) `describe`.

- [ ] **Step 4: Lancer les tests repo**

```bash
npm run test:integration -- posts-repository ideas-repository
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/posts.ts src/lib/db/repositories/ideas.ts test/integration/posts-repository.test.ts test/integration/ideas-repository.test.ts
git commit -m "🤖 feat(spec-24): repos posts/idées découplés (title, suppression des jointures)"
```

---

### Task 3: Tool MCP create_post

**Files:**
- Modify: `src/lib/mcp/tools/posts.ts`
- Test: `test/integration/mcp-tools-content.test.ts`

- [ ] **Step 1: Mettre à jour le tool**

`postImpl.create` :

```ts
create: (
  userId: string,
  input: { title: string; content: string; status?: 'draft' | 'validated' },
) => createPost(userId, input),
```

`registerTool('create_post', …)` :

```ts
{
  title: 'Créer un post',
  description: 'Crée un post rédigé.',
  inputSchema: {
    title: z.string(),
    content: z.string(),
    status: z.enum(['draft', 'validated']).optional(),
  },
},
```

- [ ] **Step 2: Mettre à jour le test**

`test/integration/mcp-tools-content.test.ts` :
- `create_post : crée un post draft` → appeler `postImpl.create(userId, { title: 'T', content: "texte rédigé par l'agent" })`, retirer `expect(created.ideaId)`, ajouter `expect(created.title).toBe('T')`. Retirer le `createIdea` devenu inutile.
- Renommer le 2ᵉ test en `create_post : status est propagé`, appeler `{ title: 'T', content: 'c', status: 'validated' }`, garder `expect(created.status).toBe('validated')`, retirer l'assertion `writingTemplateId`.
- Le test `edit + set_post_status` : remplacer `createIdea` + `{ ideaId: idea.id, content }` par `{ title: 'T', content }`.

- [ ] **Step 3: Lancer le test**

```bash
npm run test:integration -- mcp-tools-content
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mcp/tools/posts.ts test/integration/mcp-tools-content.test.ts
git commit -m "🤖 feat(spec-24): create_post MCP = { title, content, status }"
```

---

### Task 4: Server actions

**Files:**
- Modify: `src/app/(app)/posts/actions-core.ts`, `src/app/(app)/posts/actions.ts`
- Modify: `src/app/(app)/ideas/actions-core.ts`, `src/app/(app)/ideas/actions.ts`
- Test: `test/integration/posts-actions.test.ts`, `test/integration/ideas-actions.test.ts`

- [ ] **Step 1: `posts/actions-core.ts` — créer `createPostCore`, ajouter `title` à l'update**

```ts
import { z } from 'zod';
import { createPost, deletePost, updatePost } from '@/lib/db/repositories/posts';
import type { ActionState } from '../ideas/actions-core';

export type CreatePostState =
  | { status: 'success'; postId: string }
  | { status: 'error'; message: string };

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis').max(200),
});

export async function createPostCore(
  userId: string,
  input: { title: string },
): Promise<CreatePostState> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const post = await createPost(userId, { title: parsed.data.title, content: '' });
  return { status: 'success', postId: post.id };
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['draft', 'validated']).optional(),
});

export async function updatePostCore(
  userId: string,
  input: { id: string; title?: string; content?: string; status?: 'draft' | 'validated' },
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

- [ ] **Step 2: `posts/actions.ts` — exposer `createPostAction`, accepter `title` dans update**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import type { ActionState } from '../ideas/actions-core';
import { type CreatePostState, createPostCore, deletePostCore, updatePostCore } from './actions-core';

export async function createPostAction(input: { title: string }): Promise<CreatePostState> {
  const userId = await requireUserId();
  const result = await createPostCore(userId, input);
  if (result.status === 'success') revalidatePath('/posts');
  return result;
}

export async function updatePostAction(input: {
  id: string;
  title?: string;
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

- [ ] **Step 3: `ideas/actions-core.ts` — retirer le pont idée→post**

- Supprimer `createPostFromIdeaCore` et le type `CreatePostState`.
- Import : `import { createIdea, deleteIdea, updateIdea } from '@/lib/db/repositories/ideas';` (retirer `getIdea`). Supprimer `import { createPost } from '@/lib/db/repositories/posts';`.

- [ ] **Step 4: `ideas/actions.ts` — retirer `createPostFromIdeaAction`**

- Supprimer `createPostFromIdeaAction` et les imports `CreatePostState`, `createPostFromIdeaCore`.

- [ ] **Step 5: Mettre à jour les tests actions**

`test/integration/ideas-actions.test.ts` : retirer l'import `createPostFromIdeaCore` et son `describe`.

`test/integration/posts-actions.test.ts` : remplacer `createIdea` + `{ ideaId: idea.id, content }` par `{ title: 'T', content }` dans chaque setup. Ajouter un test :

```ts
import { createPostCore } from '@/app/(app)/posts/actions-core';

test('createPostCore crée un post draft avec titre', async () => {
  const userId = await createTestUser('cpc');
  const res = await createPostCore(userId, { title: 'Mon titre' });
  expect(res.status).toBe('success');
  if (res.status === 'success') {
    const post = await getPost(userId, res.postId);
    expect(post?.title).toBe('Mon titre');
    expect(post?.content).toBe('');
    expect(post?.status).toBe('draft');
  }
});
```

(Adapter les imports `createPostCore`, `getPost`, `createTestUser` au style du fichier.)

- [ ] **Step 6: Lancer les tests actions**

```bash
npm run test:integration -- posts-actions ideas-actions
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/posts/actions-core.ts" "src/app/(app)/posts/actions.ts" "src/app/(app)/ideas/actions-core.ts" "src/app/(app)/ideas/actions.ts" test/integration/posts-actions.test.ts test/integration/ideas-actions.test.ts
git commit -m "🤖 feat(spec-24): createPostAction autonome + titre éditable, retrait du pont idée→post"
```

---

### Task 5: UI posts

**Files:**
- Create: `src/app/(app)/posts/_components/post-create-form.tsx`
- Modify: `src/app/(app)/posts/page.tsx`, `src/app/(app)/posts/_components/post-card.tsx`, `src/app/(app)/posts/_components/empty-state.tsx`, `src/app/(app)/posts/[id]/page.tsx`, `src/app/(app)/posts/[id]/_components/post-editor.tsx`

- [ ] **Step 1: `post-create-form.tsx` (nouveau)**

```tsx
'use client';

import type React from 'react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createPostAction } from '../actions';

export function PostCreateForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const r = await createPostAction({ title: title.trim() });
      if (r.status === 'success') router.push(`/posts/${r.postId}`);
      else toast.error(r.message);
    });
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-3 rounded-lg border p-4">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre du post"
        maxLength={200}
        disabled={pending}
      />
      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? 'Création…' : 'Créer un post'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: `posts/page.tsx`**

```tsx
import { requireUserId } from '@/lib/auth/session';
import { listPosts } from '@/lib/db/repositories/posts';
import { EmptyPostsState } from './_components/empty-state';
import { PostCard } from './_components/post-card';
import { PostCreateForm } from './_components/post-create-form';

export default async function PostsPage() {
  const userId = await requireUserId();
  const posts = await listPosts(userId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Posts ({posts.length})</h1>
      </header>
      <PostCreateForm />
      {posts.length === 0 ? (
        <EmptyPostsState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `post-card.tsx`**

```tsx
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { Post } from '@/lib/db/schema';

type Props = {
  post: Post;
};

export function PostCard({ post }: Props) {
  const excerpt = post.content.length > 200 ? `${post.content.slice(0, 200)}…` : post.content;
  return (
    <Link href={`/posts/${post.id}`} className="block">
      <article className="space-y-2 rounded-lg border p-4 transition hover:bg-muted/40">
        <header className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{post.title}</span>
          <Badge variant={post.status === 'validated' ? 'default' : 'secondary'}>
            {post.status}
          </Badge>
        </header>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{excerpt}</p>
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

- [ ] **Step 4: `empty-state.tsx`**

```tsx
export function EmptyPostsState() {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Aucun post pour le moment. Crée ton premier post ci-dessus.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: `posts/[id]/page.tsx`**

- Supprimer `import { getIdea } from '@/lib/db/repositories/ideas';`.
- Supprimer les lignes `const idea = await getIdea(userId, post.ideaId); if (!idea) notFound();`.
- Retirer la prop `idea={idea}` passée à `<PostEditor … />`.

- [ ] **Step 6: `post-editor.tsx` — titre éditable, plus d'idée**

- Type import : `import type { Post, VisualTemplate } from '@/lib/db/schema';` (retirer `Idea`).
- `Props` : retirer `idea: Idea`.
- Signature : retirer `idea` des paramètres déstructurés.
- Ajouter l'état + sauvegarde du titre :

```tsx
const [title, setTitle] = useState(post.title);
const [savingTitle, startSaveTitle] = useTransition();

const saveTitle = () => {
  if (title.trim() === post.title.trim() || !title.trim()) return;
  startSaveTitle(async () => {
    const r = await updatePostAction({ id: post.id, title: title.trim() });
    if (r.status === 'error') toast.error(r.message);
  });
};
```

- Header : remplacer `<h1 className="text-xl font-bold">{idea.idea}</h1>` par un champ titre éditable :

```tsx
<Input
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  onBlur={saveTitle}
  placeholder="Titre du post"
  disabled={savingTitle}
  className="text-lg font-bold"
/>
```

(Ajouter `import { Input } from '@/components/ui/input';`.)

- [ ] **Step 7: Build + lint**

```bash
npm run lint && npx tsc --noEmit
```

Expected: aucune erreur (le découplage source est complet).

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/posts"
git commit -m "🤖 feat(spec-24): UI posts — création autonome + titre éditable, plus de source idée"
```

---

### Task 6: UI idées

**Files:**
- Modify: `src/app/(app)/ideas/_components/idea-card.tsx`, `src/app/(app)/ideas/page.tsx`, `src/app/(app)/ideas/_components/delete-idea-dialog.tsx`, `src/app/(app)/ideas/_components/idea-create-form.tsx`

- [ ] **Step 1: `idea-card.tsx` — note pure**

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Idea } from '@/lib/db/schema';
import { updateIdeaAction } from '../actions';
import { DeleteIdeaDialog } from './delete-idea-dialog';

type Props = {
  idea: Idea;
};

export function IdeaCard({ idea }: Props) {
  const [briefValue, setBriefValue] = useState(idea.brief ?? '');
  const [titleValue, setTitleValue] = useState(idea.idea);
  const [savingTitle, startSaveTitle] = useTransition();
  const [savingBrief, startSaveBrief] = useTransition();

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
    </article>
  );
}
```

- [ ] **Step 2: `ideas/page.tsx`**

```tsx
import { requireUserId } from '@/lib/auth/session';
import { listIdeas } from '@/lib/db/repositories/ideas';
import { EmptyIdeasState } from './_components/empty-state';
import { IdeaCard } from './_components/idea-card';
import { IdeaCreateForm } from './_components/idea-create-form';

export default async function IdeasPage() {
  const userId = await requireUserId();
  const ideas = await listIdeas(userId);

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
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `delete-idea-dialog.tsx`**

Remplacer le `<DialogDescription>` par : `Cette action est irréversible.`

- [ ] **Step 4: `idea-create-form.tsx`**

Remplacer la phrase d'aide (`Tu pourras éditer le brief et générer un post depuis la liste.`) par : `Tu pourras éditer le brief depuis la liste.`

- [ ] **Step 5: Build + lint**

```bash
npm run lint && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/ideas"
git commit -m "🤖 feat(spec-24): UI idées = note pure (retrait du bouton post + posts liés + cascade)"
```

---

### Task 7: Seed

**Files:**
- Modify: `src/lib/db/seeds/dev-sample.ts`

- [ ] **Step 1: Posts d'exemple avec titre, sans idée**

Remplacer `SAMPLE_POSTS` par des objets titre+contenu :

```ts
const SAMPLE_POSTS = [
  {
    title: 'Documenter avant de coder',
    content:
      'Documenter une spec avant de coder, ça paraît lent. En réalité ça évite trois allers-retours.',
  },
  {
    title: 'Une base de test dédiée',
    content:
      'Mes tests effaçaient ma base de dev à chaque run. Une base de test dédiée a réglé le problème en cinq minutes.',
  },
];
```

Dans `seedDev`, garder le seed des idées tel quel, et remplacer la boucle de création des posts par :

```ts
const existingContent = new Set((await listPosts(userId)).map((p) => p.content));
for (const p of SAMPLE_POSTS) {
  if (!existingContent.has(p.content)) {
    await createPost(userId, { title: p.title, content: p.content, status: 'draft' });
  }
}
```

(Supprimer la dérivation `ideaIds`.)

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/lib/db/seeds/dev-sample.ts
git commit -m "🤖 feat(spec-24): seed posts d'exemple avec titre, sans idée"
```

---

### Task 8: Sweep des tests d'intégration et worker

**Règle de transformation :** dans chaque fichier, tout `createPost(uid, { ideaId: <x>.id, content: <c>, ...reste })` devient `createPost(uid, { title: 'T', content: <c>, ...reste })`. Supprimer les `const idea = await createIdea(...)` (et imports `createIdea`) devenus inutiles ; conserver `createIdea` quand l'idée est testée pour elle-même.

**Files (chacun : appliquer la règle, lancer, vérifier) :**
- `test/integration/carousel-core.test.ts`
- `test/integration/carousel-pdf-upload.test.ts`
- `test/integration/mcp-tools-media.test.ts`
- `test/integration/mcp-tools-publishing.test.ts`
- `test/integration/media-actions.test.ts`
- `test/integration/publications-repository.test.ts`
- `test/integration/publish-core.test.ts`
- `test/integration/upload-image.test.ts`
- `test/integration/upload-video.test.ts`
- `test/integration/tenant-isolation.test.ts` (retirer en plus les imports + tests `listPostsByIdea`, `countPostsByIdea`, `listPostsWithIdea`)
- `test/worker/generate-image.test.ts`
- `test/worker/publish-linkedin.test.ts`
- `test/worker/render-visual.test.ts`

- [ ] **Step 1: Appliquer la règle à tous les fichiers ci-dessus**

- [ ] **Step 2: Lancer les suites intégration + worker**

```bash
npm run test:integration && npm run test:worker
```

Expected: PASS (toute la suite, pour attraper les fichiers manqués).

- [ ] **Step 3: Commit**

```bash
git add test/
git commit -m "🤖 test(spec-24): createPost sans idée (title) dans toute la suite intégration/worker"
```

---

### Task 9: Sweep des tests e2e

Chaque spec crée aujourd'hui un post via « idée → bouton Créer un post ». Nouveau flux : aller sur `/posts`, remplir `input[placeholder="Titre du post"]`, cliquer `button:has-text("Créer un post")`, attendre la navigation vers l'éditeur.

**Files:**
- `test/e2e/posts.spec.ts` (réécrire les étapes 1-3 du parcours principal)
- `test/e2e/ideas.spec.ts` (retirer les assertions/clics sur « Créer un post » de la carte ; conserver la création/édition d'idée)
- `test/e2e/calendar.spec.ts`, `test/e2e/linkedin-publish.spec.ts`, `test/e2e/carousel-video.spec.ts`, `test/e2e/post-image.spec.ts`, `test/e2e/post-visual.spec.ts`, `test/e2e/template-image-var.spec.ts` (remplacer le bloc de précondition « créer idée + cliquer Créer un post » par le nouveau flux `/posts`)

- [ ] **Step 1: Bloc de création de post réutilisable**

Dans chaque spec concernée, remplacer le bloc précondition par :

```ts
await page.goto('/posts');
await page.fill('input[placeholder="Titre du post"]', 'Post e2e');
await page.click('button:has-text("Créer un post")');
await expect(page).toHaveURL(/\/posts\/[a-z0-9]+$/);
```

Adapter les assertions aval qui s'appuyaient sur le titre de l'idée (l'en-tête de l'éditeur affiche désormais le titre du post, dans un `input`).

- [ ] **Step 2: `posts.spec.ts` — parcours détail**

Remplacer les étapes 1-3 : créer le post via `/posts` (titre « Idée pour /posts/[id] » → ou un titre dédié), vérifier la navigation vers l'éditeur, puis vérifier l'en-tête via `input[value="…"]` plutôt que `h1`. Le reste (édition contenu, validation, suppression) est inchangé.

- [ ] **Step 3: `ideas.spec.ts`**

Retirer les assertions `button:has-text("Créer un post")` et le test qui clique dessus ; conserver les tests de création d'idée (« Ajouter ») et d'édition.

- [ ] **Step 4: Lancer les e2e touchées**

```bash
npx playwright test test/e2e/posts.spec.ts test/e2e/ideas.spec.ts
```

Expected: PASS (lancer le reste à la Task 10).

- [ ] **Step 5: Commit**

```bash
git add test/e2e/
git commit -m "🤖 test(spec-24): e2e — création de post via /posts"
```

---

### Task 10: Skill

**Files:**
- Modify: `skills/content-os-redaction/SKILL.md`

- [ ] **Step 1: Mettre à jour l'appel create_post (ligne ~45)**

Remplacer la mention de `create_post` pour décrire l'état cible : `create_post` avec `title`, `content` et statut `draft` ; récupérer le `postId` renvoyé (requis pour attacher un visuel). Décrire le passage idée → post comme un usage : lire une idée via `list_ideas` / `get_idea` pour s'en inspirer, puis créer un post autonome. Aucune mention de `ideaId` ni `writingTemplateId`. État cible uniquement (pas de cadrage par contraste).

- [ ] **Step 2: Commit**

```bash
git add skills/content-os-redaction/SKILL.md
git commit -m "🤖 docs(spec-24): skill — create_post sans idée ni writing-template"
```

---

### Task 11: Vérification finale + PR

- [ ] **Step 1: Vérifier qu'aucune référence ne subsiste**

```bash
grep -rn -E "ideaId|idea_id|writingTemplateId|writing_template_id|listPostsWithIdea|PostWithIdea|listPostsByIdea|countPostsByIdea|createPostFromIdea" --include="*.ts" --include="*.tsx" src test | grep -vE "node_modules"
```

Expected: aucune occurrence (hors `ideas` repository/entité légitime).

- [ ] **Step 2: Format + lint + typecheck + suites complètes**

```bash
npm run format
npm run lint && npx tsc --noEmit && npm run test
```

Expected: tout vert (le `format` d'abord pour éviter le piège du cache Biome local).

- [ ] **Step 3: e2e complets**

```bash
npm run test:e2e
```

Expected: PASS (tolérer un retry sur flake rate-limit connu ; relancer le spec isolé si besoin).

- [ ] **Step 4: Push + PR**

```bash
git push -u origin decouple-posts-ideas
gh pr create --title "Découpler posts et idées (spec-24)" --body "<résumé spec + checklist vérif>"
```

---

## Self-Review (rempli)

- **Couverture spec** : migration+backfill (T1), schéma title (T1), MCP (T3), repos (T2), actions+createPostAction (T4), UI posts (T5), UI idées (T6), seed (T7), skill (T10), tests (T2/T3/T4/T8/T9), drop `writing_template_id` (T1/T2/T3). ✔
- **Placeholders** : les sweeps T8/T9 donnent une règle + liste exhaustive de fichiers + code représentatif (pas de « etc. » non résolu). ✔
- **Cohérence des types** : `CreatePostInput.title`, `UpdatePostPatch.title`, `postImpl.create({title,…})`, `createPostCore({title})`, `createPostAction({title})`, `PostCreateForm` → `createPostAction`, `post-editor` → `updatePostAction({title})`. Noms alignés. ✔
