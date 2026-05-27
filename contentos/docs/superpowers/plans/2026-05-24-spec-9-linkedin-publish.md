# Spec 9 — Publication LinkedIn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depuis `/posts/[id]`, publier sur LinkedIn maintenant ou planifier, avec snapshot immuable au clic, statut suivi par polling, et annulation d'une planification.

**Architecture:** Queue `publish-linkedin` (job immédiat ou différé). `publish-core` crée la ligne `publications` (snapshot figé) + enqueue. Le worker appelle `publish.ts` (porté de la v1, image lue depuis R2). Stub `CONTENT_OS_LINKEDIN_STUB=1` pour CI/E2E. Aucune migration (table `publications` déjà complète).

**Tech Stack:** BullMQ, Drizzle, fetch natif, React 19 (useTransition + useJobPolling), Vitest, Playwright.

---

## Task 1 : `publish.ts` (lib LinkedIn) + helpers purs

**Files:**
- Create: `src/lib/linkedin/publish.ts`
- Test: `test/unit/linkedin-publish.test.ts`

- [ ] **Step 1 : Tests qui échouent**

```ts
// test/unit/linkedin-publish.test.ts
import { describe, expect, test } from 'vitest';
import {
  buildExternalUrl,
  buildPostBody,
  classifyHttpError,
  publishStub,
} from '@/lib/linkedin/publish';

describe('buildExternalUrl', () => {
  test('construit l’URL du feed depuis l’URN', () => {
    expect(buildExternalUrl('urn:li:share:42')).toBe(
      'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A42/',
    );
  });
});

describe('classifyHttpError', () => {
  test('mappe les statuts vers un kind', () => {
    expect(classifyHttpError(401)).toBe('token_expired');
    expect(classifyHttpError(429)).toBe('rate_limit');
    expect(classifyHttpError(400)).toBe('invalid_content');
    expect(classifyHttpError(503)).toBe('platform_5xx');
  });
});

describe('buildPostBody', () => {
  test('texte seul : pas de content media', () => {
    const body = buildPostBody({ authorUrn: 'urn:li:person:X', content: 'hello' });
    expect(body.author).toBe('urn:li:person:X');
    expect(body.commentary).toBe('hello');
    expect(body.content).toBeUndefined();
    expect(body.lifecycleState).toBe('PUBLISHED');
  });

  test('avec image : content.media.id présent', () => {
    const body = buildPostBody({ authorUrn: 'urn:li:person:X', content: 'hi', imageUrn: 'urn:li:image:9' });
    expect(body.content).toEqual({ media: { id: 'urn:li:image:9' } });
  });
});

describe('publishStub', () => {
  test('retourne un URN/URL factices sans réseau', async () => {
    const r = await publishStub({ content: 'x', imageBytes: null, accessToken: 't', authorUrn: 'urn:li:person:X' });
    expect(r.id).toMatch(/^urn:li:share:/);
    expect(r.url).toContain('linkedin.com/feed/update/');
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npm run test:unit -- linkedin-publish`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `publish.ts`**

```ts
// src/lib/linkedin/publish.ts
import { env } from '@/lib/env';

const LINKEDIN_VERSION = '202405';
const BASE_URL = 'https://api.linkedin.com';

export type PublishResult = { id: string; url: string };
export type PublishOpts = {
  content: string;
  imageBytes: Buffer | null;
  accessToken: string;
  authorUrn: string;
};
export type PublishFn = (opts: PublishOpts) => Promise<PublishResult>;

export type FailureKind =
  | 'token_expired'
  | 'rate_limit'
  | 'invalid_content'
  | 'platform_5xx'
  | 'network';

export class LinkedInPublishError extends Error {
  kind: FailureKind;
  constructor(message: string, kind: FailureKind) {
    super(message);
    this.name = 'LinkedInPublishError';
    this.kind = kind;
  }
}

export function classifyHttpError(status: number): FailureKind {
  if (status === 401) return 'token_expired';
  if (status === 429) return 'rate_limit';
  if (status >= 400 && status < 500) return 'invalid_content';
  return 'platform_5xx';
}

export function buildExternalUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;
}

export function buildPostBody(opts: { authorUrn: string; content: string; imageUrn?: string }) {
  const body: {
    author: string;
    commentary: string;
    visibility: string;
    distribution: { feedDistribution: string };
    lifecycleState: string;
    isReshareDisabledByAuthor: boolean;
    content?: { media: { id: string } };
  } = {
    author: opts.authorUrn,
    commentary: opts.content,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED' },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (opts.imageUrn) body.content = { media: { id: opts.imageUrn } };
  return body;
}

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': LINKEDIN_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

async function initImageUpload(accessToken: string, authorUrn: string) {
  const res = await fetch(`${BASE_URL}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: headers(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!res.ok)
    throw new LinkedInPublishError(
      `initializeUpload ${res.status}: ${await res.text().catch(() => '')}`,
      classifyHttpError(res.status),
    );
  const data = (await res.json()) as { value: { uploadUrl: string; image: string } };
  return { uploadUrl: data.value.uploadUrl, imageUrn: data.value.image };
}

async function uploadBinary(uploadUrl: string, bytes: Buffer, accessToken: string) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok)
    throw new LinkedInPublishError(
      `image upload ${res.status}`,
      classifyHttpError(res.status),
    );
}

async function postToFeed(opts: PublishOpts, imageUrn?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/rest/posts`, {
    method: 'POST',
    headers: headers(opts.accessToken),
    body: JSON.stringify(buildPostBody({ authorUrn: opts.authorUrn, content: opts.content, imageUrn })),
  });
  if (!res.ok)
    throw new LinkedInPublishError(
      `post ${res.status}: ${await res.text().catch(() => '')}`,
      classifyHttpError(res.status),
    );
  return res.headers.get('x-restli-id') ?? `urn:li:share:${Date.now()}`;
}

export const publishReal: PublishFn = async (opts) => {
  try {
    let imageUrn: string | undefined;
    if (opts.imageBytes) {
      const { uploadUrl, imageUrn: urn } = await initImageUpload(opts.accessToken, opts.authorUrn);
      await uploadBinary(uploadUrl, opts.imageBytes, opts.accessToken);
      imageUrn = urn;
    }
    const urn = await postToFeed(opts, imageUrn);
    return { id: urn, url: buildExternalUrl(urn) };
  } catch (err) {
    if (err instanceof LinkedInPublishError) throw err;
    throw new LinkedInPublishError(
      `réseau : ${err instanceof Error ? err.message : String(err)}`,
      'network',
    );
  }
};

export const publishStub: PublishFn = async () => {
  const rand = Math.random().toString(36).slice(2, 10);
  const urn = `urn:li:share:stub-${rand}`;
  await new Promise((r) => setTimeout(r, 300));
  return { id: urn, url: buildExternalUrl(urn) };
};

export const publish: PublishFn = env.CONTENT_OS_LINKEDIN_STUB === '1' ? publishStub : publishReal;
```

- [ ] **Step 4 : Lancer → passe**

Run: `npm run test:unit -- linkedin-publish`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/linkedin/publish.ts test/unit/linkedin-publish.test.ts
git commit -m "🤖 feat(spec-9): lib publication LinkedIn + stub (texte/image, erreurs typées)"
```

---

## Task 2 : Repo — publication active d'un post

**Files:**
- Modify: `src/lib/db/repositories/publications.ts`
- Test: `test/integration/publications-repository.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
// test/integration/publications-repository.test.ts
import { describe, expect, test } from 'vitest';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  getLatestPublicationForPost,
} from '@/lib/db/repositories/publications';
import { createTestUser } from './helpers/seed';

describe('getLatestPublicationForPost', () => {
  test('renvoie la publication la plus récente du post', async () => {
    const userId = await createTestUser('pubrepo');
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    expect(await getLatestPublicationForPost(userId, post.id)).toBeUndefined();
    await createPublication(userId, { postId: post.id, contentSnapshot: 'c', platform: 'linkedin', status: 'queued' });
    const latest = await getLatestPublicationForPost(userId, post.id);
    expect(latest?.status).toBe('queued');
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npm run test:integration -- publications-repository`
Expected: FAIL.

- [ ] **Step 3 : Ajouter la fonction**

Dans `src/lib/db/repositories/publications.ts`, ajouter `desc` à l'import drizzle (`import { and, desc, eq } from 'drizzle-orm';`) et :

```ts
export async function getLatestPublicationForPost(
  userId: string,
  postId: string,
): Promise<Publication | undefined> {
  const rows = await db
    .select()
    .from(publications)
    .where(and(eq(publications.userId, userId), eq(publications.postId, postId)))
    .orderBy(desc(publications.createdAt))
    .limit(1);
  return rows[0];
}
```

- [ ] **Step 4 : Lancer → passe**

Run: `npm run test:integration -- publications-repository`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/db/repositories/publications.ts test/integration/publications-repository.test.ts
git commit -m "🤖 feat(spec-9): getLatestPublicationForPost"
```

---

## Task 3 : `publish-core` (snapshot + publishNow/schedule/cancel)

**Files:**
- Create: `src/lib/publications/publish-core.ts`
- Test: `test/integration/publish-core.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
// test/integration/publish-core.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost } from '@/lib/db/repositories/posts';
import { getPublication } from '@/lib/db/repositories/publications';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import { cancelPublication, publishNow, schedulePublication } from '@/lib/publications/publish-core';
import { createTestUser } from './helpers/seed';

async function setup(label: string) {
  const userId = await createTestUser(label);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: 'urn:li:person:X',
    displayName: 'X',
    accessToken: 'enc',
    expiresAt: new Date(Date.now() + 1e9),
    scopes: 'w_member_social',
  });
  const idea = await createIdea(userId, { idea: 'i' });
  const post = await createPost(userId, { ideaId: idea.id, content: 'mon contenu' });
  return { userId, postId: post.id };
}

describe('publish-core', () => {
  test('publishNow fige le snapshot et enqueue (queued)', async () => {
    const { userId, postId } = await setup('pn');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const pub = await publishNow(userId, postId, enqueue);
    expect(pub.status).toBe('queued');
    expect(pub.contentSnapshot).toBe('mon contenu');
    expect(enqueue).toHaveBeenCalledWith(pub.id, undefined);
  });

  test('schedule fige le snapshot avec scheduledFor (scheduled) + delay', async () => {
    const { userId, postId } = await setup('sc');
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const when = new Date(Date.now() + 3_600_000);
    const pub = await schedulePublication(userId, postId, when, 'Europe/Paris', enqueue);
    expect(pub.status).toBe('scheduled');
    expect(pub.scheduledFor?.getTime()).toBe(when.getTime());
    expect(enqueue).toHaveBeenCalled();
  });

  test('publishNow échoue si pas de compte LinkedIn', async () => {
    const userId = await createTestUser('nolink');
    const idea = await createIdea(userId, { idea: 'i' });
    const post = await createPost(userId, { ideaId: idea.id, content: 'c' });
    await expect(publishNow(userId, post.id, vi.fn())).rejects.toThrow(/LinkedIn/);
  });

  test('cancel supprime une publication scheduled et dequeue', async () => {
    const { userId, postId } = await setup('cx');
    const dequeue = vi.fn().mockResolvedValue(undefined);
    const pub = await schedulePublication(userId, postId, new Date(Date.now() + 1e6), 'UTC', vi.fn());
    await cancelPublication(userId, pub.id, dequeue);
    expect(await getPublication(userId, pub.id)).toBeUndefined();
    expect(dequeue).toHaveBeenCalledWith(pub.id);
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npm run test:integration -- publish-core`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `publish-core.ts`**

```ts
// src/lib/publications/publish-core.ts
import { getMedia } from '@/lib/db/repositories/media';
import { getPost } from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getPublication,
  type Publication,
} from '@/lib/db/repositories/publications';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';

export type EnqueueFn = (publicationId: string, delayMs?: number) => Promise<void>;
export type DequeueFn = (publicationId: string) => Promise<void>;

async function buildSnapshot(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (!post) throw new Error('Post introuvable');
  const account = await getSocialAccount(userId, 'linkedin');
  if (!account) throw new Error('Aucun compte LinkedIn connecté');

  let snapshotKeys: string[] | null = null;
  let mediaKind: 'image' | 'carousel' | 'video' | null = null;
  if (post.mediaId) {
    const media = await getMedia(userId, post.mediaId);
    if (media) {
      snapshotKeys = [media.assetKey];
      mediaKind = media.kind;
    }
  }
  return { post, account, snapshotKeys, mediaKind };
}

export async function publishNow(
  userId: string,
  postId: string,
  enqueue: EnqueueFn,
): Promise<Publication> {
  const { post, account, snapshotKeys, mediaKind } = await buildSnapshot(userId, postId);
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: post.content,
    platform: 'linkedin',
    socialAccountId: account.id,
    snapshotKeys,
    mediaKind,
    status: 'queued',
  });
  await enqueue(pub.id, undefined);
  return pub;
}

export async function schedulePublication(
  userId: string,
  postId: string,
  when: Date,
  tz: string,
  enqueue: EnqueueFn,
): Promise<Publication> {
  const { post, account, snapshotKeys, mediaKind } = await buildSnapshot(userId, postId);
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: post.content,
    platform: 'linkedin',
    socialAccountId: account.id,
    snapshotKeys,
    mediaKind,
    status: 'scheduled',
    scheduledFor: when,
    scheduledTz: tz,
  });
  await enqueue(pub.id, Math.max(0, when.getTime() - Date.now()));
  return pub;
}

export async function cancelPublication(
  userId: string,
  publicationId: string,
  dequeue: DequeueFn,
): Promise<void> {
  const pub = await getPublication(userId, publicationId);
  if (!pub) return;
  if (pub.status !== 'scheduled' && pub.status !== 'queued') {
    throw new Error('Publication non annulable (déjà en cours ou terminée)');
  }
  await dequeue(publicationId);
  await deletePublication(userId, publicationId);
}
```

> Note : vérifier la signature de `upsertSocialAccount` (Spec 8) — adapter l'objet du test si nécessaire.

- [ ] **Step 4 : Lancer → passe**

Run: `npm run test:integration -- publish-core`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/publications/publish-core.ts test/integration/publish-core.test.ts
git commit -m "🤖 feat(spec-9): publish-core (snapshot figé, publishNow/schedule/cancel)"
```

---

## Task 4 : Queue + enqueue + registry

**Files:**
- Modify: `src/lib/queue/client.ts`, `src/lib/queue/registry.ts`, `src/lib/queue/enqueue.ts`

- [ ] **Step 1 : Ajouter la queue dans `client.ts`**

```ts
export type PublishLinkedinJob = { publicationId: string; userId: string };
export type PublishLinkedinResult = { externalUrl: string };

export const publishLinkedinQueue = new Queue<PublishLinkedinJob, PublishLinkedinResult>(
  'publish-linkedin',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);
```

- [ ] **Step 2 : Enregistrer dans `registry.ts`**

Importer `publishLinkedinQueue` et ajouter `'publish-linkedin': publishLinkedinQueue` au registre.

- [ ] **Step 3 : Ajouter l'enqueue/dequeue dans `enqueue.ts`**

```ts
import { publishLinkedinQueue, type PublishLinkedinJob } from './client';

export async function enqueuePublishLinkedin(
  payload: PublishLinkedinJob,
  delayMs?: number,
): Promise<string> {
  const job = await publishLinkedinQueue.add('publish', payload, {
    jobId: payload.publicationId,
    delay: delayMs && delayMs > 0 ? delayMs : undefined,
  });
  return job.id!;
}

export async function removePublishLinkedin(publicationId: string): Promise<void> {
  const job = await publishLinkedinQueue.getJob(publicationId);
  if (job) await job.remove();
}
```

- [ ] **Step 4 : tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/queue/client.ts src/lib/queue/registry.ts src/lib/queue/enqueue.ts
git commit -m "🤖 feat(spec-9): queue publish-linkedin + enqueue différé + remove"
```

---

## Task 5 : Worker processor `publish-linkedin`

**Files:**
- Create: `src/worker/queues/publish-linkedin.ts`
- Modify: `src/worker/index.ts`
- Test: `test/worker/publish-linkedin.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
// test/worker/publish-linkedin.test.ts
import type { Job } from 'bullmq';
import { describe, expect, test, vi } from 'vitest';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost } from '@/lib/db/repositories/posts';
import { createPublication, getPublication } from '@/lib/db/repositories/publications';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import { LinkedInPublishError } from '@/lib/linkedin/publish';
import { makeProcessPublishLinkedin } from '@/worker/queues/publish-linkedin';
import { createTestUser } from '../integration/helpers/seed';

async function makePub(label: string, content = 'hello') {
  const userId = await createTestUser(label);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: 'urn:li:person:X',
    displayName: 'X',
    accessToken: 'plain-token', // chiffré via encryptToken dans le test réel
    expiresAt: new Date(Date.now() + 1e9),
    scopes: 'w_member_social',
  });
  const idea = await createIdea(userId, { idea: 'i' });
  const post = await createPost(userId, { ideaId: idea.id, content });
  const pub = await createPublication(userId, {
    postId: post.id,
    contentSnapshot: content,
    platform: 'linkedin',
    status: 'queued',
  });
  return { userId, pubId: pub.id };
}

function job(publicationId: string, userId: string): Job<{ publicationId: string; userId: string }> {
  return { data: { publicationId, userId } } as Job<{ publicationId: string; userId: string }>;
}

describe('processPublishLinkedin', () => {
  test('succès → published + externalUrl', async () => {
    const { userId, pubId } = await makePub('pub-ok');
    const publish = vi.fn().mockResolvedValue({ id: 'urn:li:share:1', url: 'https://x/1' });
    const storage = { download: vi.fn() } as never;
    const process = makeProcessPublishLinkedin({ publish, storage, decrypt: (t) => t });
    await process(job(pubId, userId));
    const pub = await getPublication(userId, pubId);
    expect(pub?.status).toBe('published');
    expect(pub?.externalUrl).toBe('https://x/1');
  });

  test('erreur permanente (token_expired) → failed, ne relève pas', async () => {
    const { userId, pubId } = await makePub('pub-perm');
    const publish = vi.fn().mockRejectedValue(new LinkedInPublishError('401', 'token_expired'));
    const storage = { download: vi.fn() } as never;
    const process = makeProcessPublishLinkedin({ publish, storage, decrypt: (t) => t });
    await expect(process(job(pubId, userId))).resolves.toBeDefined();
    const pub = await getPublication(userId, pubId);
    expect(pub?.status).toBe('failed');
    expect(pub?.failureKind).toBe('token_expired');
  });

  test('erreur transitoire (platform_5xx) → failed + relève (retry BullMQ)', async () => {
    const { userId, pubId } = await makePub('pub-trans');
    const publish = vi.fn().mockRejectedValue(new LinkedInPublishError('503', 'platform_5xx'));
    const storage = { download: vi.fn() } as never;
    const process = makeProcessPublishLinkedin({ publish, storage, decrypt: (t) => t });
    await expect(process(job(pubId, userId))).rejects.toThrow();
    const pub = await getPublication(userId, pubId);
    expect(pub?.failureKind).toBe('platform_5xx');
  });
});
```

- [ ] **Step 2 : Lancer → échoue**

Run: `npm run test:worker -- publish-linkedin`
Expected: FAIL.

- [ ] **Step 3 : Implémenter le processor**

```ts
// src/worker/queues/publish-linkedin.ts
import type { Job } from 'bullmq';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { getPublication, updatePublication } from '@/lib/db/repositories/publications';
import { LinkedInPublishError, type PublishFn } from '@/lib/linkedin/publish';
import type { PublishLinkedinJob, PublishLinkedinResult } from '@/lib/queue/client';
import type { Storage } from '@/lib/storage';

const TRANSIENT = new Set(['rate_limit', 'platform_5xx', 'network']);

type Deps = { publish: PublishFn; storage: Storage; decrypt: (blob: string) => string };

export function makeProcessPublishLinkedin(deps: Deps) {
  return async function processPublishLinkedin(
    job: Job<PublishLinkedinJob>,
  ): Promise<PublishLinkedinResult> {
    const { publicationId, userId } = job.data;
    const pub = await getPublication(userId, publicationId);
    if (!pub) throw new Error(`publication ${publicationId} introuvable`);
    const account = await getSocialAccount(userId, 'linkedin');
    if (!account) throw new Error('compte LinkedIn introuvable');

    await updatePublication(userId, publicationId, {
      status: 'publishing',
      attempts: pub.attempts + 1,
      lastAttemptAt: new Date(),
    });

    let imageBytes: Buffer | null = null;
    if (pub.snapshotKeys && pub.snapshotKeys.length > 0) {
      imageBytes = await deps.storage.download(pub.snapshotKeys[0]!);
    }

    try {
      const result = await deps.publish({
        content: pub.contentSnapshot,
        imageBytes,
        accessToken: deps.decrypt(account.accessToken),
        authorUrn: account.externalId,
      });
      await updatePublication(userId, publicationId, {
        status: 'published',
        publishedAt: new Date(),
        externalPostId: result.id,
        externalUrl: result.url,
        failureKind: null,
        lastError: null,
      });
      return { externalUrl: result.url };
    } catch (err) {
      const kind = err instanceof LinkedInPublishError ? err.kind : 'network';
      await updatePublication(userId, publicationId, {
        status: 'failed',
        failureKind: kind,
        lastError: err instanceof Error ? err.message : String(err),
      });
      if (TRANSIENT.has(kind)) throw err; // laisse BullMQ ré-essayer
      return { externalUrl: '' }; // erreur permanente : pas de retry
    }
  };
}
```

- [ ] **Step 4 : Brancher dans `src/worker/index.ts`**

Ajouter les imports :

```ts
import { decryptToken } from '@/lib/crypto';
import { publish, publishStub } from '@/lib/linkedin/publish';
import { makeProcessPublishLinkedin } from './queues/publish-linkedin';
```

Choisir le stub selon l'env (cohérent avec les autres) et ajouter le Worker au tableau `workers` :

```ts
const publishFn = env.CONTENT_OS_LINKEDIN_STUB === '1' ? publishStub : publish;
if (env.CONTENT_OS_LINKEDIN_STUB === '1') {
  console.log('[worker] CONTENT_OS_LINKEDIN_STUB=1 active : LinkedIn NOT called.');
}
// …
new Worker(
  'publish-linkedin',
  makeProcessPublishLinkedin({ publish: publishFn, storage: getStorage(), decrypt: decryptToken }),
  { connection, concurrency: 2 },
),
```

- [ ] **Step 5 : Lancer → passe**

Run: `npm run test:worker -- publish-linkedin`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add src/worker/queues/publish-linkedin.ts src/worker/index.ts test/worker/publish-linkedin.test.ts
git commit -m "🤖 feat(spec-9): worker publish-linkedin (publishing→published/failed, retry transitoire)"
```

---

## Task 6 : Server Actions

**Files:**
- Create: `src/app/(app)/posts/[id]/publish-actions.ts`

- [ ] **Step 1 : Implémenter les actions**

```ts
// src/app/(app)/posts/[id]/publish-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import {
  cancelPublication,
  publishNow,
  schedulePublication,
} from '@/lib/publications/publish-core';
import { enqueuePublishLinkedin, removePublishLinkedin } from '@/lib/queue/enqueue';

type Result = { status: 'success'; jobKey?: string } | { status: 'error'; message: string };

export async function publishNowAction(postId: string): Promise<Result> {
  const userId = await requireUserId();
  try {
    const pub = await publishNow(userId, postId, (id) =>
      enqueuePublishLinkedin({ publicationId: id, userId }).then(() => undefined),
    );
    revalidatePath(`/posts/${postId}`);
    return { status: 'success', jobKey: pub.id };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}

export async function scheduleAction(input: {
  postId: string;
  whenIso: string;
  tz: string;
}): Promise<Result> {
  const userId = await requireUserId();
  try {
    await schedulePublication(userId, input.postId, new Date(input.whenIso), input.tz, (id, delay) =>
      enqueuePublishLinkedin({ publicationId: id, userId }, delay).then(() => undefined),
    );
    revalidatePath(`/posts/${input.postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}

export async function cancelScheduleAction(input: {
  postId: string;
  publicationId: string;
}): Promise<Result> {
  const userId = await requireUserId();
  try {
    await cancelPublication(userId, input.publicationId, (id) => removePublishLinkedin(id));
    revalidatePath(`/posts/${input.postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}
```

- [ ] **Step 2 : tsc**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3 : Commit**

```bash
git add "src/app/(app)/posts/[id]/publish-actions.ts"
git commit -m "🤖 feat(spec-9): server actions publier/planifier/annuler"
```

---

## Task 7 : UI — encart Publication sur `/posts/[id]`

**Files:**
- Create: `src/app/(app)/posts/[id]/_components/publish-panel.tsx`
- Modify: `src/app/(app)/posts/[id]/page.tsx`

- [ ] **Step 1 : Charger la publication dans `page.tsx`**

Importer `getLatestPublicationForPost` et le passer à un nouveau composant `<PublishPanel post={post} publication={latestPub} />`. Récupérer `const latestPub = await getLatestPublicationForPost(userId, post.id);` et l'ajouter au rendu (sous `<PostEditor … />`).

- [ ] **Step 2 : Composant client `publish-panel.tsx`**

Composant `'use client'` qui, selon `publication?.status` :
- `undefined` ou `failed` : boutons **Publier maintenant** (appelle `publishNowAction`, met le `jobKey` retourné dans un state local) + **Planifier** (input `datetime-local` → `scheduleAction({ postId, whenIso, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })`). En `failed`, afficher d'abord `publication.lastError`/un message selon `failureKind` (token_expired → « reconnecte ton compte LinkedIn » avec lien `/settings/connections`).
- `scheduled` : « Planifié pour le {scheduledFor} » + **Annuler** (`cancelScheduleAction`).
- `queued` / `publishing` : « Publication en cours… » et monter `useJobPolling(jobKey ?? publication.id, { queue: 'publish-linkedin', defaultToast: false, onCompleted: () => router.refresh() })` pour rafraîchir à la fin.
- `published` : « Publié le {publishedAt} » + lien `publication.externalUrl` (target _blank). Pas de bouton publier.

Utiliser `useTransition` pour les actions, `toast` (sonner) pour les erreurs, `router.refresh()` après succès. S'inspirer de `_components/add-visual-dialog.tsx` pour le pattern action+polling.

- [ ] **Step 3 : Vérif manuelle (dev)**

Run: `npm run build`
Expected: build OK, route `/posts/[id]` compile.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(app)/posts/[id]/_components/publish-panel.tsx" "src/app/(app)/posts/[id]/page.tsx"
git commit -m "🤖 feat(spec-9): encart Publication sur /posts/[id] (publier/planifier/annuler/statut)"
```

---

## Task 8 : E2E

**Files:**
- Create: `test/e2e/linkedin-publish.spec.ts`

- [ ] **Step 1 : Écrire le test (stub LinkedIn)**

Flux : signup (helper `signup` copié d'un spec existant) → connecter LinkedIn via stub (`/api/linkedin/connect`) → créer une idée + générer un post (via stub) OU créer un post directement → aller sur `/posts/[id]` → **Publier maintenant** → attendre statut `Publié` + lien LinkedIn visible. Puis (autre post) **Planifier** (datetime futur) → **Annuler** → l'encart revient à l'état publiable.

Réutiliser les helpers des specs précédentes (`fetchMagicLink`, `signup`) et le pattern de `test/e2e/post-image.spec.ts` pour créer un post. Sélecteurs robustes (`getByRole('button', { name: 'Publier maintenant' })`, `exact: true` si collision).

- [ ] **Step 2 : Lancer**

Run: `CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e -- test/e2e/linkedin-publish.spec.ts`
Expected: PASS. (Tuer les workers orphelins avant : `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"`.)

- [ ] **Step 3 : Commit**

```bash
git add test/e2e/linkedin-publish.spec.ts
git commit -m "🤖 test(spec-9): e2e publier maintenant + planifier/annuler (stub)"
```

---

## Task 9 : Validation finale + PR

- [ ] **Step 1 : Suite complète**

Run: `npm run db:test:prepare && npm test`
Expected: tous verts.

- [ ] **Step 2 : Lint + format + tsc**

Run: `npx biome check --write . && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3 : E2E complète**

Run: `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"; CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e`
Expected: tous verts (re-run si flake rate-limit/worker orphelin).

- [ ] **Step 4 : Push + PR (ne pas merger)**

```bash
git push -u origin spec-9/linkedin-publish
gh pr create --base main --title "spec 9: publication LinkedIn (publier/planifier/annuler)" --body "…"
```

- [ ] **Step 5 : Surveiller CI vert**, puis rendre la main pour validation du merge (tester le vrai OAuth+publish manuellement avant merge).
```
