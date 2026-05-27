# Spec 4 (Pipeline ideas → posts) Design

> **Position dans la roadmap v2** : 4e spec sur 8. Suit Spec 1 (bootstrap), Spec 2 (schema + brand) et Spec 3 (voice/templates/visual-briefing/visual-styles). Active le premier flow produit visible : capturer une idée → générer un post draft via Claude.

## Objectif

Permettre à un user signé de :

1. Capturer une idée (titre + brief optionnel) depuis l'UI `/ideas` — sachant que la majorité des idées arriveront plus tard via l'API/MCP (Spec 7), mais on cale le contrat data dès Spec 4.
2. Déclencher la génération d'un post à partir d'une idée et d'un writing_template, **de manière asynchrone** via la queue BullMQ `generate-post`.
3. Suivre l'avancement du job en polling et voir le post draft apparaître dans `/posts` à la fin (~5-15s).
4. Éditer le contenu du draft, basculer le statut `draft ↔ validated`, supprimer.

Avant Spec 4, l'infrastructure BullMQ (Spec 1) ne porte qu'un worker `dummy`. Après Spec 4, elle porte un worker `generate-post` qui appelle Claude (`@anthropic-ai/sdk`) et persiste en DB.

## Scope

**Inclus :**

- Migration additive sur `posts` : ajout colonne `generation_job_id text NULL UNIQUE` (idempotency).
- Extension du repository `ideas` : `listIdeas` triée par `updated_at DESC`, ajout `listPostsByIdea(userId, ideaId)`, ajout `countPostsByIdea(userId, ideaId)`.
- Extension du repository `posts` : `listPosts` triée par `updated_at DESC`, signature de `createPost` enrichie de `generationJobId?`, ajout `getPostByGenerationJobId(jobKey)` (lecture cross-tenant légitime : utilisé par le worker pour l'idempotency).
- Nouvelle queue BullMQ `generate-post` + worker `processGeneratePost` qui exécute `write → polish → lintEditorial` via Claude Sonnet 4.6, puis insère la row `posts` avec `generation_job_id` set.
- Généralisation de l'endpoint `GET /api/jobs/[id]` : aujourd'hui hardcodé sur `dummy`, demain capable d'interroger n'importe quelle queue enregistrée. Param query `?queue=generate-post` requis ; fallback `dummy` pour rétro-compat tant que Spec 1 n'a pas été refactor.
- Nouvelle Server Action `enqueueGeneratePost(ideaId, writingTemplateId)` : valide brief non vide + ownership + existence template → enqueue avec un `jobKey` UUID v4 → retourne `{ jobKey }`.
- Server Actions ideas : `createIdeaAction`, `updateIdeaAction`, `deleteIdeaAction` (wrappers Zod + auth + repos existants).
- Server Actions posts : `updatePostAction` (édition contenu, change status), `deletePostAction`.
- Page `/ideas` : liste, formulaire d'ajout en haut, card avec titre + brief inline blur-to-save, dropdown writing_template + bouton "Générer un post" (disabled si brief vide ou pas de template), spinner + polling pendant un job actif sur cette idée, toast `Post #X créé` à la fin avec lien.
- Page `/posts` : liste read-only des posts (extrait du contenu, idée source, status, date), card cliquable → `/posts/[id]`.
- Page `/posts/[id]` : titre = idée source, textarea full-width blur-to-save sur le contenu, bouton "Valider" (draft → validated) ou "Remettre en draft" (validated → draft), bouton "Supprimer" avec confirmation.
- Sidebar `/app` : nouveaux liens `Idées` et `Posts` en haut, au-dessus de Settings.
- Tests unit : `lintEditorial`, fonction de composition du prompt (`buildSystemPrompt`).
- Tests worker : job `generate-post` happy path + idempotency + brief manquant (mock Anthropic via injection de dépendance).
- Tests integration : Server Actions ideas/posts + sentinelle tenant isolation étendue.
- Tests E2E Playwright : `/ideas` (création, édition inline, déclenchement génération avec stub worker), `/posts/[id]` (édition, valider, supprimer).

**Hors scope :**

- Handshake `needs_clarification` MCP/API (noté dans `architecture-cible-v2-design.md` § Décisions en suspens — à reprendre Spec 7+).
- Slot visuel sur la page post détail : laissé à Spec 5. Spec 4 affiche juste une pastille `Pas de visuel` quand `mediaId === null`, sans CTA.
- Publication LinkedIn : Spec 6. Le bouton "Valider" ne fait que basculer le statut.
- API REST / MCP server : Spec 7.
- Bull-Board, SSE, rate-limiting : Spec 8.
- Reprise des `posts` orphelins après crash worker autrement que via le retry BullMQ natif : pas besoin de table jobs en DB au MVP (cohérent avec archi cible).
- Recherche / filtres / pagination sur `/ideas` et `/posts` : tout en mémoire pour le MVP. À revoir quand on aura 200+ items par user.

## Architecture cible

### Schéma DB

**Migration additive** sur `posts` :

```ts
generationJobId: text('generation_job_id').unique(),
```

- Nullable : tous les posts créés manuellement (futur API, ou data legacy) n'ont pas de `generation_job_id`.
- UNIQUE : garantit qu'un même `jobKey` ne peut pas créer deux rows même en cas de double-delivery BullMQ (le INSERT échouera en violation de contrainte, le worker rattrape l'erreur et retourne le post existant).

Pas de nouvel index dédié : la contrainte UNIQUE crée l'index implicite suffisant.

Pas de changement sur `ideas` (déjà conforme à la spec v1 portée).

### Repositories

**`src/lib/db/repositories/ideas.ts`** — modifications :

```ts
export async function listIdeas(userId: string): Promise<Idea[]> {
  return db.select().from(ideas)
    .where(eq(ideas.userId, userId))
    .orderBy(desc(ideas.updatedAt));
}

export async function listPostsByIdea(userId: string, ideaId: string): Promise<Post[]> {
  return db.select().from(posts)
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

`listPostsByIdea` et `countPostsByIdea` sont dans `ideas.ts` (et non `posts.ts`) parce qu'elles servent la page `/ideas` ; les exports croisés entre repos sont acceptables tant qu'ils restent rares.

**`src/lib/db/repositories/posts.ts`** — modifications :

```ts
export type CreatePostInput = {
  ideaId: string;
  content: string;
  writingTemplateId?: string | null;
  mediaId?: string | null;
  status?: 'draft' | 'validated';
  generationJobId?: string | null;   // ← nouveau
};

export async function listPosts(userId: string): Promise<Post[]> {
  return db.select().from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.updatedAt));
}

export async function getPostByGenerationJobId(jobKey: string): Promise<Post | undefined> {
  const rows = await db.select().from(posts)
    .where(eq(posts.generationJobId, jobKey))
    .limit(1);
  return rows[0];
}
```

`getPostByGenerationJobId` est **délibérément non-scopée user_id** : c'est un lookup par clé unique appelé exclusivement par le worker, qui n'a pas de session. Le `jobKey` est généré côté Server Action authentifiée et reste interne. Documenté dans une note JSDoc et couvert par le test tenant-isolation (sentinelle : un user ne peut pas lookup le job d'un autre user via les Server Actions).

### Queue & enqueue

**`src/lib/queue/client.ts`** — extension :

```ts
export type GeneratePostJob = {
  userId: string;
  ideaId: string;
  writingTemplateId: string;
  jobKey: string;
};

export type GeneratePostResult = { postId: string };

export const generatePostQueue = new Queue<GeneratePostJob, GeneratePostResult>(
  'generate-post',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);
```

**`src/lib/queue/enqueue.ts`** — ajout :

```ts
export async function enqueueGeneratePost(payload: GeneratePostJob): Promise<string> {
  const job = await generatePostQueue.add('write+polish', payload, {
    jobId: payload.jobKey,   // dédup BullMQ : 2 enqueue même jobKey = 1 seul job
  });
  return job.id!;
}
```

**`src/lib/queue/registry.ts`** — nouveau, pour généraliser `/api/jobs/[id]` :

```ts
import { dummyQueue, generatePostQueue } from './client';
import type { Queue } from 'bullmq';

export const queueRegistry: Record<string, Queue> = {
  dummy: dummyQueue,
  'generate-post': generatePostQueue,
};
```

### Endpoint `/api/jobs/[id]`

Refactor du handler `src/app/api/jobs/[id]/route.ts` :

```ts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const url = new URL(req.url);
  const queueName = url.searchParams.get('queue') ?? 'dummy';
  const queue = queueRegistry[queueName];
  if (!queue) return Response.json({ error: 'Unknown queue' }, { status: 400 });
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

- Pas d'auth sur cet endpoint au MVP : le `jobKey` UUID v4 fait office de capability token (impossible à deviner). À durcir Spec 8 si nécessaire (lookup user via DB et match avec session).
- Status BullMQ remappé tel quel : `waiting | active | completed | failed | delayed`.

### Worker `generate-post`

**`src/worker/queues/generate-post.ts`** — nouveau fichier.

Dépendances injectables (pour les tests) :

```ts
type Deps = {
  generate: (params: { idea: Idea; voice: Voice; template: WritingTemplate }) => Promise<string>;
};

export function makeProcessGeneratePost(deps: Deps) {
  return async (job: Job<GeneratePostJob>): Promise<GeneratePostResult> => {
    const { userId, ideaId, writingTemplateId, jobKey } = job.data;

    // 1. Idempotency : si un post existe déjà avec ce jobKey, on le retourne.
    const existing = await getPostByGenerationJobId(jobKey);
    if (existing) return { postId: existing.id };

    // 2. Charger les données (lecture fresh, pas de snapshot).
    const idea = await getIdea(userId, ideaId);
    if (!idea) throw new Error(`Idea ${ideaId} not found for user ${userId}`);
    if (!idea.brief?.trim()) throw new Error(`Idea ${ideaId} has no brief`);

    const template = await getWritingTemplate(userId, writingTemplateId);
    if (!template) throw new Error(`Writing template ${writingTemplateId} not found`);

    const voice = await getVoice(userId);
    if (!voice) throw new Error(`Voice not found for user ${userId} (should have been seeded)`);

    // 3. Générer (write + polish + lint).
    const content = await deps.generate({ idea, voice, template });

    // 4. Persister. Si race condition (double delivery + INSERT concurrent),
    //    la contrainte UNIQUE remonte une erreur que l'on rattrape pour
    //    récupérer le post déjà inséré.
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

**`src/lib/ai/generate-post.ts`** — nouvelle implémentation par défaut de `deps.generate` :

Importe `@anthropic-ai/sdk` (à ajouter aux dépendances), expose 3 fonctions internes :

- `buildSystemPrompt({ voice, template })` : assemble le prompt système à partir de `voice.content`, `template.structure`, `template.writingRules`. Format identique au pattern v1 (portage direct des prompts).
- `write({ idea, systemPrompt })` : appel Claude Sonnet 4.6 (`claude-sonnet-4-6`), `max_tokens: 1500`, user message = `Idée : ${idea.idea}\n\nBrief :\n${idea.brief}\n\nRédige le post final ...`.
- `polish({ idea, draft, systemPrompt })` : second appel Claude Sonnet 4.6, user message = `Idée d'origine : ${idea.idea}\n\nDraft :\n${draft}\n\nRelis et polis ...`.
- `lintEditorial(text)` : passe sur le texte pour appliquer les règles inviolables de la voice (pas de tiret cadratin → remplace par virgule, etc.). Pure, testable unit.

Export consolidé `generate({ idea, voice, template })` = compose les 3 et retourne le contenu final lintéé.

**`src/worker/index.ts`** — étendu :

```ts
import { makeProcessGeneratePost } from './queues/generate-post';
import { generate } from '@/lib/ai/generate-post';
import { processDummy } from './queues/dummy';

const workers = [
  new Worker('dummy', processDummy, { connection, concurrency: 4 }),
  new Worker('generate-post', makeProcessGeneratePost({ generate }),
    { connection, concurrency: 4 }),
];
```

### Server Actions

**`src/app/(app)/ideas/actions.ts`** :

```ts
'use server';

import { z } from 'zod';
import { requireUserId } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { createIdea, updateIdea, deleteIdea, getIdea } from '@/lib/db/repositories/ideas';
import { getWritingTemplate } from '@/lib/db/repositories/writing-templates';
import { enqueueGeneratePost } from '@/lib/queue/enqueue';
import { randomUUID } from 'node:crypto';

const CreateSchema = z.object({
  idea: z.string().trim().min(1, 'Titre requis'),
  brief: z.string().trim().optional(),
});

export async function createIdeaAction(input: unknown) {
  const userId = await requireUserId();
  const data = CreateSchema.parse(input);
  await createIdea(userId, { idea: data.idea, brief: data.brief || undefined });
  revalidatePath('/ideas');
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  idea: z.string().trim().min(1).optional(),
  brief: z.string().trim().nullable().optional(),
});

export async function updateIdeaAction(input: unknown) {
  const userId = await requireUserId();
  const data = UpdateSchema.parse(input);
  await updateIdea(userId, data.id, { idea: data.idea, brief: data.brief });
  revalidatePath('/ideas');
}

export async function deleteIdeaAction(id: string) {
  const userId = await requireUserId();
  await deleteIdea(userId, id);
  revalidatePath('/ideas');
}

export async function enqueueGeneratePostAction(input: { ideaId: string; writingTemplateId: string }) {
  const userId = await requireUserId();
  const idea = await getIdea(userId, input.ideaId);
  if (!idea) throw new Error('Idée introuvable');
  if (!idea.brief?.trim()) throw new Error('Brief requis pour générer');
  const template = await getWritingTemplate(userId, input.writingTemplateId);
  if (!template) throw new Error('Template introuvable');

  const jobKey = randomUUID();
  await enqueueGeneratePost({
    userId,
    ideaId: input.ideaId,
    writingTemplateId: input.writingTemplateId,
    jobKey,
  });
  return { jobKey };
}
```

**`src/app/(app)/posts/actions.ts`** :

```ts
'use server';

import { z } from 'zod';
import { requireUserId } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { updatePost, deletePost } from '@/lib/db/repositories/posts';

const UpdateSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1).optional(),
  status: z.enum(['draft', 'validated']).optional(),
});

export async function updatePostAction(input: unknown) {
  const userId = await requireUserId();
  const data = UpdateSchema.parse(input);
  await updatePost(userId, data.id, {
    content: data.content,
    status: data.status,
  });
  revalidatePath('/posts');
  revalidatePath(`/posts/${data.id}`);
}

export async function deletePostAction(id: string) {
  const userId = await requireUserId();
  await deletePost(userId, id);
  revalidatePath('/posts');
}
```

**Helper `requireUserId()`** : à créer dans `src/lib/auth/session.ts` (Task 1 Step 1). Encapsule le pattern actuellement répété dans `/settings/brand/actions.ts` :

```ts
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './server';

export async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');
  return session.user.id;
}
```

Refactor opportunist : remplacer le pattern manuel dans `/settings/brand/{actions,page}.tsx` par cet helper en passant. Hors-scope si ça génère du churn ailleurs.

### UI `/ideas`

**`src/app/(app)/ideas/page.tsx`** — Server Component :

- Charge `listIdeas(userId)` + pour chaque idée `listPostsByIdea(userId, idea.id)` (N+1 acceptable au MVP, à optimiser si > 100 ideas) + `listWritingTemplates(userId)`.
- Rend `<IdeaCreateForm />` (Client Component) + `<IdeasList ideas={...} postsByIdea={...} templates={...} />`.

**`src/app/(app)/ideas/_components/idea-create-form.tsx`** — Client :

- Form shadcn avec un `<Input name="idea" />` et un `<Textarea name="brief" />`.
- `onSubmit` : appelle `createIdeaAction`, reset le form, `toast.success('Idée capturée')`.

**`src/app/(app)/ideas/_components/idea-card.tsx`** — Client :

- Props : `{ idea, posts, templates }`.
- Input titre + Textarea brief, both with `onBlur` handler that calls `updateIdeaAction` if value changed.
- Composant `<GeneratePostControls idea={idea} templates={templates} />` :
  - `<Select>` shadcn pour choisir le template (default = premier).
  - `<Button>` "Générer un post" — `disabled` si `!idea.brief?.trim()` ou `templates.length === 0` ou job actif.
  - Au clic : appelle `enqueueGeneratePostAction({ ideaId, writingTemplateId })`, reçoit `{ jobKey }`, démarre un hook `useJobPolling(jobKey, 'generate-post')`.
- Pastille "N posts générés" avec liens vers `/posts/[id]` si `posts.length > 0`.
- `IconButton` poubelle → dialog confirm → `deleteIdeaAction(id)` → toast.

**`src/hooks/use-job-polling.ts`** — Client :

```ts
export function useJobPolling(jobKey: string | null, queue: string) {
  const [state, setState] = useState<JobState | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (!jobKey) return;
    let cancelled = false;
    const poll = async () => {
      while (!cancelled) {
        const res = await fetch(`/api/jobs/${jobKey}?queue=${queue}`);
        if (!res.ok) { setState({ status: 'failed', error: 'fetch failed' }); return; }
        const json = await res.json();
        setState(json);
        if (json.status === 'completed') {
          toast.success('Post créé', {
            action: { label: 'Voir', onClick: () => router.push(`/posts/${json.result.postId}`) },
          });
          router.refresh();
          return;
        }
        if (json.status === 'failed') {
          toast.error(`Génération échouée : ${json.error}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobKey, queue, router]);
  return state;
}
```

### UI `/posts` et `/posts/[id]`

**`src/app/(app)/posts/page.tsx`** — Server Component :

- Charge en une seule query : `listPostsWithIdea(userId)` à ajouter dans `posts.ts` repository — fait un `leftJoin(ideas)` et retourne `Array<{ post: Post; idea: Pick<Idea, 'id' | 'idea'> }>`. Évite le N+1.
- Affiche une grille shadcn `<Card>` cliquables avec extrait du contenu (200 premiers chars + `…`), titre de l'idée source, badge status, date relative.
- Vide → `<EmptyState>` "Aucun post pour le moment. Génère ton premier depuis /ideas."

**`src/app/(app)/posts/[id]/page.tsx`** — Server Component :

- Charge `getPost(userId, id)` + `getIdea(userId, post.ideaId)`.
- Rend `<PostEditor post={post} idea={idea} />`.

**`src/app/(app)/posts/[id]/_components/post-editor.tsx`** — Client :

- Header : titre = idea.idea, breadcrumb `/posts` ← retour.
- Textarea pleine largeur, valeur initiale = `post.content`, blur-to-save vers `updatePostAction`.
- Toggle status : si `draft` → bouton "Valider" qui call `updatePostAction({ status: 'validated' })` ; si `validated` → bouton "Remettre en draft".
- Bouton "Supprimer" → dialog confirm → `deletePostAction(id)` → `router.push('/posts')`.
- Pastille `Pas de visuel` (gris discret) si `mediaId === null`. Pas de CTA, juste un signal visuel.

### Sidebar `/app`

Modification de `src/components/layout/sidebar.tsx` (ou équivalent posé Spec 3) :

```
Idées      → /ideas
Posts      → /posts
─────────
Settings
  Brand    → /settings/brand
  Voice    → /settings/voice
  ...
```

Le groupe `Settings` reste collapsible / visible tel quel.

## Tests

### Unit (`vitest --project=unit`)

- `lintEditorial(text)` : 6+ cases (tiret cadratin, staccato, négations performatives, etc.).
- `buildSystemPrompt({ voice, template })` : snapshot test sur le format de sortie.

### Worker (`vitest --project=worker`)

Fichier `test/worker/generate-post.test.ts` :

- **Happy path** : enqueue un job → mock `generate` retourne `"Post final"` → assert que la row `posts` existe avec ce contenu, `status='draft'`, `generation_job_id=jobKey`, `writing_template_id` set.
- **Idempotency BullMQ** : 2 jobs avec même `jobId` → un seul post inséré.
- **Idempotency en cas de race** : pré-insère manuellement un post avec ce `jobKey`, lance le job → assert que le job retourne `{ postId: <existant> }` sans réinsérer ni rappeler `generate`.
- **Brief manquant** : insère une idée sans brief, enqueue → assert que le job fail avec une erreur claire et ne crée pas de post.
- **Mock Anthropic** : pas d'appel réseau, on injecte `deps.generate` directement.

### Integration (`vitest --project=integration`)

- `test/integration/ideas-actions.test.ts` : CRUD ideas via Server Actions, tenant isolation (user A ne peut pas créer/lire/modifier les ideas de user B).
- `test/integration/posts-actions.test.ts` : update content/status, delete, tenant isolation.
- `test/integration/tenant-isolation.test.ts` : étendre la sentinelle existante pour couvrir `ideas` et `posts` (déjà en place Spec 2/3, juste ajouter les assertions).

### E2E Playwright (`test:e2e`)

- `test/e2e/ideas.spec.ts` :
  - signup → `/ideas` vide → créer une idée → la voir → éditer le brief → blur sauvegarde → bouton "Générer" passe enabled.
  - Cliquer "Générer" → polling → assertion `Post #X créé` toast apparaît dans les 15s → click sur "Voir" → arrive sur `/posts/[id]`.
  - **Mock worker** : pour ne pas dépendre de Claude API en CI, le worker entrypoint `src/worker/index.ts` lit `env.CONTENT_OS_AI_STUB`. Si `=1`, il injecte un `generate` qui retourne `\`[STUB] ${idea.idea} via ${template.name}\`` après un `setTimeout(500ms)`. Aucun appel Anthropic. En E2E Playwright le worker est démarré avec cette variable set ; en dev local, l'user laisse `=0` et utilise sa vraie clé `ANTHROPIC_API_KEY`.
- `test/e2e/posts.spec.ts` : ouvrir un post existant (fixture insérée DB-side), éditer le contenu, blur sauvegarde, cliquer "Valider", vérifier le badge "validated", cliquer "Supprimer", confirmer, vérifier redirection `/posts`.

## Décisions techniques tranchées

- **Pas de snapshot voice/template dans le payload du job** : le worker lit la version courante en DB. Justification : payload BullMQ minimal (cohérent archi cible), la voice change rarement, et si l'user édite sa voice pendant qu'un job tourne (1% des cas) le comportement "prend la dernière version" est acceptable. À reconsidérer en Spec 6/8 si on a un cas où ça pose problème.
- **Modèle Claude** : `claude-sonnet-4-6` pour `write` et `polish`. Sonnet est le bon compromis qualité/coût pour de la réécriture éditoriale (cohérent v1 et avec le knowledge cutoff actuel).
- **Retries** : 3 attempts avec backoff exponentiel 1m / 2m / 4m. Couvre les rate-limits Anthropic transitoires. Pas de retry sur erreur de validation (brief vide) — ces erreurs sont déterministes, on les laisse fail rapidement.
- **Concurrence worker** : 4 jobs `generate-post` en parallèle (cohérent archi cible). Acceptable pour un MVP single-instance ; scaling horizontal via `--scale worker=N` plus tard.
- **`jobKey` = UUID v4 généré côté Server Action** : sert simultanément de (a) `jobId` BullMQ pour la dédup à l'enqueue, (b) capability token pour le polling sans auth, (c) clé d'idempotency en DB. Une seule string, trois usages.
- **Endpoint `/api/jobs/[id]` non-authentifié** : sécurité par obscurité (UUID v4). Acceptable au MVP, à durcir Spec 8.

## Migration & déploiement

1. `npm run db:generate` → produit la migration Drizzle additive pour `posts.generation_job_id`.
2. `npm run db:migrate` en local et en CI.
3. Pas de backfill : les posts existants gardent `generation_job_id = NULL` (et il n'y en a quasi pas vu qu'on est en pré-prod).
4. `npm install @anthropic-ai/sdk` (nouvelle dépendance).
5. `.env.example` enrichi avec `ANTHROPIC_API_KEY=`. Variable lue dans `src/lib/env.ts` (à étendre).
6. Pas d'impact pour les users existants — purement additif.

## Critères de réussite

- Un user signé peut accéder à `/ideas` (vide ou peuplé) et `/posts` (vide ou peuplé).
- Il crée une idée avec titre seul : OK, card apparaît, bouton "Générer" disabled.
- Il édite le brief, blur : sauvegarde silencieuse (toast subtil "✓ sauvegardé" optionnel), bouton "Générer" passe enabled.
- Il clique "Générer" : spinner sur la card, ~5-15s plus tard toast "Post #X créé" avec lien.
- Click sur "Voir" → page `/posts/[id]` avec le contenu généré.
- Il édite le contenu, blur sauvegarde silencieuse.
- Il clique "Valider", badge passe à `validated`, bouton devient "Remettre en draft".
- Il supprime, confirme, retourne sur `/posts` sans la row supprimée.
- Re-cliquer "Générer" sur la même idée crée un 2e post, pastille "2 posts générés" apparaît sur la card idée.
- Supprimer l'idée supprime les posts liés en cascade (FK existante).
- Deux users distincts ne voient jamais les ideas/posts l'un de l'autre (sentinelle tenant isolation verte).
- `npm test` vert (unit + integration + worker). `npm run test:e2e` vert.
- Aucun appel synchrone IA depuis le `web` : tout passe par la queue (vérifiable par grep "anthropic" dans `src/app/**`).

## Hors-scope rappelé

- Handshake `needs_clarification` (Spec 7+).
- Slot visuel sur la card post avec CTA "Générer depuis un template" / "Uploader" (Spec 5).
- Publication LinkedIn (Spec 6).
- API REST / MCP (Spec 7).
- Bull-Board, SSE, rate-limiting, monitoring (Spec 8).
- Recherche / filtres / pagination sur les listes.
- Versioning du brief ou du contenu post.
- Génération multi-template "en batch" (générer 3 posts d'un coup avec 3 templates différents).
