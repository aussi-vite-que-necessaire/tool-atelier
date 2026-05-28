# Spec 1 Bootstrap content-os-v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le repo `content-os-v2` from scratch et y poser le squelette technique (Next.js + Drizzle + Better-Auth magic link + BullMQ + Storage adapter + tests + CI), avec un flow E2E vérifié signup → dashboard → logout.

**Architecture:** Monolith Next.js 16 App Router. Web et worker partagent `src/lib/`. Postgres + Redis en compose dev, Next.js et worker natifs sur l'hôte pour HMR. Resend pour les emails (InMemory en tests). Cloudflare R2 pour le storage (InMemory en tests). BullMQ avec 1 file dummy pour valider l'infra queue. CI GitHub Actions 5 jobs parallèles.

**Tech Stack:** Next.js 16, TypeScript strict ESM, Drizzle ORM, Postgres 16, Better-Auth + plugin magic-link, Resend, BullMQ + Redis 7, Cloudflare R2 (S3 SDK), shadcn/ui + Tailwind v4, Vitest + Playwright, Biome, Docker Compose.

**Référence spec :** `docs/superpowers/specs/2026-05-22-spec-1-bootstrap-design.md` dans le repo `content-os` actuel.

**Pré-requis exécutant :**
- Node 22 installé
- `gh` CLI installé et authentifié (`gh auth status` doit dire "Logged in")
- Docker Desktop installé et lancé
- Un compte Resend (clé API en mode test ok) — facultatif si on développe en `NODE_ENV=test`
- Un bucket Cloudflare R2 (account_id + access_key) — facultatif si on développe en `NODE_ENV=test`

---

## Task 1 : Création du repo et init Next.js

**Files :**
- Create: nouveau repo GitHub + dossier local

- [ ] **Step 1 : Créer le repo GitHub via `gh`**

Run depuis `~/Code/` (sibling du repo `content-os` actuel) :

```bash
cd ~/Code
gh repo create content-os-v2 --private --description "AVQN content-os v2 (SaaS multi-tenant)" --confirm
```

Si tu veux un autre nom (`contentos-v2`, `avqn-content`, etc.), substituer partout dans ce plan.

- [ ] **Step 2 : Init Next.js 16 dans le nouveau repo**

Run :

```bash
cd ~/Code
npx create-next-app@latest content-os-v2 --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm --yes
cd content-os-v2
```

Configurer :
- TypeScript ✓
- Tailwind ✓ (sera bumpé en v4 plus tard)
- App Router ✓
- src/ directory ✓
- Import alias `@/*` ✓
- ESLint ✗ (on utilise Biome)

- [ ] **Step 3 : Connecter le repo local au remote**

Run :

```bash
git remote add origin git@github.com:<org>/content-os-v2.git   # remplacer <org>
git branch -M main
git add -A
git commit -m "🤖 chore: init Next.js 16 + TypeScript + Tailwind"
git push -u origin main
```

- [ ] **Step 4 : Bumper TypeScript en strict et préparer ESM**

Éditer `tsconfig.json`. Remplacer tout le fichier par :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5 : Setup Biome (remplace ESLint + Prettier)**

Run :

```bash
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

Éditer `biome.json` (créé par init) :

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" }
  },
  "files": {
    "ignore": ["node_modules", ".next", "drizzle", "public"]
  }
}
```

- [ ] **Step 6 : `.gitignore` complet**

Remplacer `.gitignore` par :

```
node_modules
.next
.env
.env.local
.DS_Store
*.log
playwright-report
test-results
coverage
```

- [ ] **Step 7 : Commit setup**

```bash
git add -A
git commit -m "🤖 chore: TypeScript strict + Biome + .gitignore"
git push
```

---

## Task 2 : Docker Compose dev (postgres + redis)

**Files :**
- Create: `docker/compose.yml`, `docker-compose.yml` (shortcut), `docker/postgres-init.sql`
- Create: `.env.example`
- Modify: `package.json` (npm scripts)

- [ ] **Step 1 : Créer le compose dev**

Créer `docker/compose.yml` :

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: contentos
    ports: ['5432:5432']
    volumes: ['postgres_data:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U app -d contentos']
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    volumes: ['redis_data:/data']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

Créer `docker-compose.yml` à la racine (shortcut) :

```yaml
include:
  - docker/compose.yml
```

- [ ] **Step 2 : `.env.example`**

Créer `.env.example` :

```
# App
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgres://app:app@localhost:5432/contentos

# Redis
REDIS_URL=redis://localhost:6379

# Email (Resend) — laisser vide en dev local pour utiliser InMemory
RESEND_API_KEY=
RESEND_FROM=onboarding@resend.dev

# Storage (Cloudflare R2) — laisser vide en dev local pour utiliser InMemory
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# Better-Auth secret (générer via `openssl rand -base64 32`)
BETTER_AUTH_SECRET=
```

- [ ] **Step 3 : Démarrer postgres et redis**

Run :

```bash
docker compose up -d
docker compose ps
```

Attendu : 2 services `running (healthy)` au bout de quelques secondes (`docker compose ps` affiche `healthy`).

- [ ] **Step 4 : Mettre à jour package.json scripts**

Éditer `package.json`, remplacer la section `scripts` par :

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check .",
  "format": "biome format --write ."
}
```

(Les autres scripts viennent dans les tasks suivantes au fur et à mesure des dépendances.)

- [ ] **Step 5 : Smoke check Next.js boote**

Run :

```bash
cp .env.example .env
npm run dev
```

Attendu : Next.js démarre sur `http://localhost:3000`. Ouvrir dans un navigateur → page Next.js par défaut. Tuer avec Ctrl+C.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "🤖 chore: docker compose dev (postgres + redis) + .env.example"
git push
```

---

## Task 3 : Drizzle setup + schema initial + migration

**Files :**
- Create: `drizzle.config.ts`, `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/env.ts`
- Create: `drizzle/0000_initial.sql` (généré)
- Modify: `package.json` (add scripts)

- [ ] **Step 1 : Installer Drizzle + pg + zod**

```bash
npm install drizzle-orm pg zod
npm install --save-dev drizzle-kit @types/pg
```

- [ ] **Step 2 : Créer `src/lib/env.ts` (validation env vars)**

Créer `src/lib/env.ts` :

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
});

export const env = envSchema.parse(process.env);
```

- [ ] **Step 3 : Créer `src/lib/db/schema.ts`**

```ts
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

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
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
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

export const settings = pgTable('settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull().default(''),
  brandColor: text('brand_color').notNull().default('#000000'),
  brandSignature: text('brand_signature').notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Settings = typeof settings.$inferSelect;
```

- [ ] **Step 4 : Créer `src/lib/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '@/lib/env';
import * as schema from './schema';

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 5 : Créer `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 6 : Installer dotenv (utilisé par drizzle-kit)**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 7 : Ajouter scripts DB dans `package.json`**

Ajouter dans `scripts` :

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio",
"db:push": "drizzle-kit push"
```

- [ ] **Step 8 : Générer la première migration**

Remplir `BETTER_AUTH_SECRET` dans `.env` :

```bash
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
```

Puis générer :

```bash
npm run db:generate
```

Attendu : un fichier `drizzle/0000_*.sql` est créé avec les `CREATE TABLE` pour les 5 tables, et `drizzle/meta/_journal.json` apparaît.

- [ ] **Step 9 : Appliquer la migration**

```bash
npm run db:migrate
```

Attendu : "Migrations applied successfully". Vérifier avec :

```bash
docker compose exec postgres psql -U app -d contentos -c "\dt"
```

Attendu : les tables `user`, `session`, `account`, `verification`, `settings` listées.

- [ ] **Step 10 : Commit**

```bash
git add -A
git commit -m "🤖 feat(db): Drizzle setup + schema initial (auth + settings)"
git push
```

---

## Task 4 : Settings repository + tests integration + tenant isolation

**Files :**
- Create: `src/lib/db/repositories/settings.ts`, `vitest.config.ts`, `test/setup-integration.ts`, `test/integration/settings-repository.test.ts`, `test/integration/tenant-isolation.test.ts`
- Modify: `package.json` (test scripts)

- [ ] **Step 1 : Installer Vitest**

```bash
npm install --save-dev vitest @vitest/ui
```

- [ ] **Step 2 : Créer `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./test/setup-integration.ts'],
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
    testTimeout: 10_000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3 : Créer `test/setup-integration.ts`**

```ts
import { beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import { settings, account, session, verification, user } from '@/lib/db/schema';

// Reset complet de la DB avant chaque test integration/worker pour isolation.
// Pas appliqué aux tests unit (qui ne touchent pas la DB).
beforeEach(async () => {
  await db.delete(settings);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
});
```

- [ ] **Step 4 : Créer `src/lib/db/repositories/settings.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '../client';
import { settings, type Settings } from '../schema';

export async function getSettings(userId: string): Promise<Settings | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertSettings(userId: string): Promise<Settings> {
  await db.insert(settings).values({ userId }).onConflictDoNothing();
  return (await getSettings(userId))!;
}

type SettingsPatch = Partial<Pick<Settings, 'brandName' | 'brandColor' | 'brandSignature'>>;

export async function updateSettings(userId: string, patch: SettingsPatch): Promise<Settings | undefined> {
  await db
    .update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.userId, userId));
  return getSettings(userId);
}
```

- [ ] **Step 5 : Créer `test/integration/settings-repository.test.ts`**

```ts
import { describe, test, expect } from 'vitest';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { getSettings, upsertSettings, updateSettings } from '@/lib/db/repositories/settings';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

describe('settings repository', () => {
  test('upsertSettings crée une row vide', async () => {
    await makeUser('u1', 'a@test.com');
    const s = await upsertSettings('u1');
    expect(s.userId).toBe('u1');
    expect(s.brandName).toBe('');
  });

  test('upsertSettings est idempotent', async () => {
    await makeUser('u1', 'a@test.com');
    await upsertSettings('u1');
    const s = await upsertSettings('u1');
    expect(s.userId).toBe('u1');
  });

  test('updateSettings met à jour les champs et updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    await upsertSettings('u1');
    const before = (await getSettings('u1'))!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateSettings('u1', { brandName: 'Acme' });
    expect(updated?.brandName).toBe('Acme');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('getSettings retourne undefined pour user inexistant', async () => {
    const s = await getSettings('nonexistent');
    expect(s).toBeUndefined();
  });
});
```

- [ ] **Step 6 : Créer `test/integration/tenant-isolation.test.ts`**

```ts
import { describe, test, expect } from 'vitest';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { getSettings, upsertSettings, updateSettings } from '@/lib/db/repositories/settings';

describe('tenant isolation sentinelle', () => {
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
```

- [ ] **Step 7 : Ajouter test scripts dans `package.json`**

Ajouter dans `scripts` :

```json
"test": "vitest run",
"test:unit": "vitest run test/unit",
"test:integration": "vitest run test/integration",
"test:worker": "vitest run test/worker",
"test:watch": "vitest"
```

- [ ] **Step 8 : Run tests**

```bash
NODE_ENV=test npm run test:integration
```

Attendu : 6 tests passent (4 settings + 2 isolation). Si erreur, ouvrir le message, corriger, relancer.

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "🤖 test(db): settings repository + tenant isolation sentinelle"
git push
```

---

## Task 5 : Storage adapter (R2 + InMemory)

**Files :**
- Create: `src/lib/storage/types.ts`, `src/lib/storage/r2.ts`, `src/lib/storage/in-memory.ts`, `src/lib/storage/index.ts`, `test/unit/storage.test.ts`

- [ ] **Step 1 : Installer le SDK S3**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2 : Créer `src/lib/storage/types.ts`**

```ts
export interface Storage {
  upload(opts: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<void>;
  signedUrl(opts: { key: string; expiresInSeconds?: number }): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

- [ ] **Step 3 : Créer `src/lib/storage/r2.ts`**

```ts
import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
  HeadObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Storage } from './types';

export class R2Storage implements Storage {
  private client: S3Client;
  constructor(
    private bucket: string,
    opts: { accountId: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async upload(opts: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: opts.key, Body: opts.body, ContentType: opts.contentType,
    }));
  }

  async signedUrl(opts: { key: string; expiresInSeconds?: number }): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: opts.key }),
      { expiresIn: opts.expiresInSeconds ?? 3600 },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4 : Créer `src/lib/storage/in-memory.ts`**

```ts
import type { Storage } from './types';

export class InMemoryStorage implements Storage {
  private store = new Map<string, { body: Buffer; contentType: string }>();

  async upload(opts: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<void> {
    this.store.set(opts.key, { body: Buffer.from(opts.body), contentType: opts.contentType });
  }

  async signedUrl(opts: { key: string; expiresInSeconds?: number }): Promise<string> {
    if (!this.store.has(opts.key)) throw new Error(`Key not found: ${opts.key}`);
    const expires = Math.floor(Date.now() / 1000) + (opts.expiresInSeconds ?? 3600);
    return `https://test.invalid/${opts.key}?expires=${expires}`;
  }

  async delete(key: string): Promise<void> { this.store.delete(key); }
  async exists(key: string): Promise<boolean> { return this.store.has(key); }
  get(key: string) { return this.store.get(key); }
  clear() { this.store.clear(); }
}
```

- [ ] **Step 5 : Créer `src/lib/storage/index.ts`**

```ts
import { env } from '@/lib/env';
import type { Storage } from './types';
import { R2Storage } from './r2';
import { InMemoryStorage } from './in-memory';

let instance: Storage | undefined;

export function getStorage(): Storage {
  if (instance) return instance;
  if (env.NODE_ENV === 'test' || !env.R2_ACCOUNT_ID) {
    instance = new InMemoryStorage();
  } else {
    instance = new R2Storage(env.R2_BUCKET!, {
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    });
  }
  return instance;
}

export type { Storage };
```

- [ ] **Step 6 : Créer `test/unit/storage.test.ts`**

```ts
import { describe, test, expect } from 'vitest';
import { InMemoryStorage } from '@/lib/storage/in-memory';

describe('InMemoryStorage', () => {
  test('upload puis exists retourne true', async () => {
    const s = new InMemoryStorage();
    await s.upload({ key: 'foo.png', body: Buffer.from('hello'), contentType: 'image/png' });
    expect(await s.exists('foo.png')).toBe(true);
  });

  test('exists retourne false pour key absente', async () => {
    const s = new InMemoryStorage();
    expect(await s.exists('missing.png')).toBe(false);
  });

  test('signedUrl retourne une URL test.invalid', async () => {
    const s = new InMemoryStorage();
    await s.upload({ key: 'foo.png', body: Buffer.from('x'), contentType: 'image/png' });
    const url = await s.signedUrl({ key: 'foo.png' });
    expect(url).toMatch(/^https:\/\/test\.invalid\/foo\.png\?expires=\d+$/);
  });

  test('signedUrl throw si key absente', async () => {
    const s = new InMemoryStorage();
    await expect(s.signedUrl({ key: 'missing.png' })).rejects.toThrow('Key not found');
  });

  test('delete retire la key', async () => {
    const s = new InMemoryStorage();
    await s.upload({ key: 'foo.png', body: Buffer.from('x'), contentType: 'image/png' });
    await s.delete('foo.png');
    expect(await s.exists('foo.png')).toBe(false);
  });

  test('get retourne body + contentType', async () => {
    const s = new InMemoryStorage();
    await s.upload({ key: 'foo.png', body: Buffer.from('hello'), contentType: 'image/png' });
    const blob = s.get('foo.png');
    expect(blob?.contentType).toBe('image/png');
    expect(blob?.body.toString()).toBe('hello');
  });
});
```

Créer aussi le dossier `test/unit` s'il n'existe pas (`mkdir -p test/unit`).

- [ ] **Step 7 : Run tests**

```bash
NODE_ENV=test npm run test:unit
```

Attendu : 6 tests storage passent.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "🤖 feat(storage): adapter R2 + InMemory + tests"
git push
```

---

## Task 6 : Email service (Resend + InMemory)

**Files :**
- Create: `src/lib/email/types.ts`, `src/lib/email/resend.ts`, `src/lib/email/in-memory.ts`, `src/lib/email/send.ts`, `test/unit/email.test.ts`

- [ ] **Step 1 : Installer Resend SDK**

```bash
npm install resend
```

- [ ] **Step 2 : Créer `src/lib/email/types.ts`**

```ts
export type EmailMessage = { to: string; subject: string; html: string };

export interface EmailSender {
  send(opts: EmailMessage): Promise<void>;
  inbox?(to: string): EmailMessage[];
  clear?(): void;
}
```

- [ ] **Step 3 : Créer `src/lib/email/resend.ts`**

```ts
import { Resend } from 'resend';
import type { EmailMessage, EmailSender } from './types';

export class ResendEmailSender implements EmailSender {
  private resend: Resend;
  constructor(apiKey: string, private from: string) {
    this.resend = new Resend(apiKey);
  }
  async send(opts: EmailMessage): Promise<void> {
    const result = await this.resend.emails.send({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (result.error) throw new Error(`Resend error: ${result.error.message}`);
  }
}
```

- [ ] **Step 4 : Créer `src/lib/email/in-memory.ts`**

```ts
import type { EmailMessage, EmailSender } from './types';

export class InMemoryEmailSender implements EmailSender {
  private store: EmailMessage[] = [];

  async send(opts: EmailMessage): Promise<void> {
    this.store.push(opts);
  }

  inbox(to: string): EmailMessage[] {
    return this.store.filter((e) => e.to === to);
  }

  clear(): void {
    this.store = [];
  }
}
```

- [ ] **Step 5 : Créer `src/lib/email/send.ts`**

```ts
import { env } from '@/lib/env';
import type { EmailSender, EmailMessage } from './types';
import { ResendEmailSender } from './resend';
import { InMemoryEmailSender } from './in-memory';

let instance: EmailSender | undefined;

export function getEmailSender(): EmailSender {
  if (instance) return instance;
  if (env.NODE_ENV === 'test' || !env.RESEND_API_KEY) {
    instance = new InMemoryEmailSender();
  } else {
    instance = new ResendEmailSender(
      env.RESEND_API_KEY,
      env.RESEND_FROM ?? 'onboarding@resend.dev',
    );
  }
  return instance;
}

export async function sendEmail(opts: EmailMessage): Promise<void> {
  return getEmailSender().send(opts);
}
```

- [ ] **Step 6 : Créer `test/unit/email.test.ts`**

```ts
import { describe, test, expect } from 'vitest';
import { InMemoryEmailSender } from '@/lib/email/in-memory';

describe('InMemoryEmailSender', () => {
  test('send stocke le message', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'Hi', html: '<p>Hi</p>' });
    expect(sender.inbox('a@test.com')).toHaveLength(1);
  });

  test('inbox filtre par destinataire', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'A', html: '<p>A</p>' });
    await sender.send({ to: 'b@test.com', subject: 'B', html: '<p>B</p>' });
    expect(sender.inbox('a@test.com')).toHaveLength(1);
    expect(sender.inbox('a@test.com')[0]?.subject).toBe('A');
  });

  test('clear vide l\'inbox', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'Hi', html: '<p>Hi</p>' });
    sender.clear();
    expect(sender.inbox('a@test.com')).toHaveLength(0);
  });
});
```

- [ ] **Step 7 : Run tests**

```bash
NODE_ENV=test npm run test:unit
```

Attendu : 9 tests passent (6 storage + 3 email).

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "🤖 feat(email): Resend + InMemory + tests"
git push
```

---

## Task 7 : Queue setup (BullMQ + dummy worker + test)

**Files :**
- Create: `src/lib/queue/client.ts`, `src/lib/queue/enqueue.ts`, `src/worker/index.ts`, `src/worker/queues/dummy.ts`, `test/worker/dummy.test.ts`
- Modify: `package.json` (worker + dev:all + tsx)

- [ ] **Step 1 : Installer BullMQ + ioredis + tsx**

```bash
npm install bullmq ioredis
npm install --save-dev tsx concurrently
```

- [ ] **Step 2 : Créer `src/lib/queue/client.ts`**

```ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const dummyQueue = new Queue<{ message: string }, { ok: true; echoed: string }>(
  'dummy',
  { connection: redisConnection },
);
```

- [ ] **Step 3 : Créer `src/lib/queue/enqueue.ts`**

```ts
import { dummyQueue } from './client';

export async function enqueueDummy(message: string): Promise<string> {
  const job = await dummyQueue.add('echo', { message });
  return job.id!;
}
```

- [ ] **Step 4 : Créer `src/worker/queues/dummy.ts`**

```ts
import type { Job } from 'bullmq';

export async function processDummy(job: Job<{ message: string }>): Promise<{ ok: true; echoed: string }> {
  console.log(`[dummy] processing job ${job.id} : ${job.data.message}`);
  return { ok: true, echoed: job.data.message };
}
```

- [ ] **Step 5 : Créer `src/worker/index.ts`**

```ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '@/lib/env';
import { processDummy } from './queues/dummy';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const workers = [
  new Worker('dummy', processDummy, { connection, concurrency: 4 }),
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

- [ ] **Step 6 : Ajouter scripts worker dans `package.json`**

Ajouter dans `scripts` :

```json
"worker": "tsx watch --env-file=.env src/worker/index.ts",
"dev:all": "concurrently -n web,worker -c blue,magenta 'npm run dev' 'npm run worker'"
```

- [ ] **Step 7 : Smoke check worker boote**

Run :

```bash
npm run worker
```

Attendu : log `[worker] 1 consumer(s) ready`. Tuer avec Ctrl+C, vérifier qu'on a le log `SIGINT received, closing...`.

- [ ] **Step 8 : Créer `test/worker/dummy.test.ts`**

```ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { enqueueDummy } from '@/lib/queue/enqueue';
import { processDummy } from '@/worker/queues/dummy';

let worker: Worker;
let connection: IORedis;
let queueEvents: QueueEvents;

beforeAll(async () => {
  connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  worker = new Worker('dummy', processDummy, { connection, concurrency: 1 });
  queueEvents = new QueueEvents('dummy', { connection: { url: process.env.REDIS_URL } });
  await queueEvents.waitUntilReady();
});

afterAll(async () => {
  await worker.close();
  await queueEvents.close();
  await connection.quit();
});

describe('dummy queue round-trip', () => {
  test('enqueue + process retourne le résultat attendu', async () => {
    const jobId = await enqueueDummy('hello world');
    const result = await new Promise<{ ok: true; echoed: string }>((resolve, reject) => {
      queueEvents.on('completed', ({ jobId: id, returnvalue }) => {
        if (id === jobId) resolve(JSON.parse(returnvalue as unknown as string));
      });
      queueEvents.on('failed', ({ jobId: id, failedReason }) => {
        if (id === jobId) reject(new Error(failedReason));
      });
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
    expect(result).toEqual({ ok: true, echoed: 'hello world' });
  });
});
```

Créer `mkdir -p test/worker` si besoin.

- [ ] **Step 9 : Run le test worker**

```bash
NODE_ENV=test npm run test:worker
```

Attendu : 1 test passe. Si timeout, vérifier que redis tourne (`docker compose ps`).

- [ ] **Step 10 : Commit**

```bash
git add -A
git commit -m "🤖 feat(queue): BullMQ + dummy worker + test round-trip"
git push
```

---

## Task 8 : Better-Auth setup (magic link + Drizzle adapter + hook)

**Files :**
- Create: `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `src/app/api/auth/[...all]/route.ts`
- Modify: `src/middleware.ts` (create), `.env`

- [ ] **Step 1 : Installer Better-Auth**

```bash
npm install better-auth
```

- [ ] **Step 2 : Créer `src/lib/auth/server.ts`**

```ts
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_URL,
  trustedOrigins: [env.APP_URL],
  plugins: [
    magicLink({
      expiresIn: 600,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: 'Connexion à content-os',
          html: `<p>Clique ici pour te connecter : <a href="${url}">${url}</a></p><p>Lien valable 10 minutes.</p>`,
        });
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await db.insert(settings).values({ userId: createdUser.id }).onConflictDoNothing();
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
```

> ⚠️ Note implémentation : si l'API exacte de Better-Auth diffère légèrement (méthodes ou imports), vérifier https://better-auth.com/docs et ajuster. La forme générale (betterAuth + plugin + adapter + databaseHooks) est stable.

- [ ] **Step 3 : Créer `src/lib/auth/client.ts`**

```ts
import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 4 : Créer `src/app/api/auth/[...all]/route.ts`**

```ts
import { auth } from '@/lib/auth/server';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth.handler);
```

- [ ] **Step 5 : Créer `src/middleware.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    const url = new URL('/signin', request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!signin|verify|api/auth|api/__test__|_next|favicon).*)'],
};
```

- [ ] **Step 6 : Smoke boot**

```bash
npm run dev
```

Attendu : Next.js démarre sans erreur. Visiter `http://localhost:3000` doit rediriger vers `/signin` (qui n'existe pas encore → 404, normal pour cette task).

Tuer avec Ctrl+C.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "🤖 feat(auth): Better-Auth + magic link + middleware + hook settings"
git push
```

---

## Task 9 : Pages auth (signin + verify) + Tailwind v4 + shadcn

**Files :**
- Create: `src/app/(auth)/signin/page.tsx`, `src/app/(auth)/verify/page.tsx`, `src/app/(auth)/layout.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`
- Setup: shadcn/ui

- [ ] **Step 1 : Bumper Tailwind en v4**

```bash
npm install tailwindcss@latest @tailwindcss/postcss@latest
```

Vérifier `postcss.config.mjs` (créé par create-next-app), il doit contenir :

```js
const config = {
  plugins: { '@tailwindcss/postcss': {} },
};
export default config;
```

- [ ] **Step 2 : Mettre à jour `src/app/globals.css`**

Remplacer son contenu par :

```css
@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 3 : Init shadcn/ui**

```bash
npx shadcn@latest init -y
```

Choisir : style "Default", base color "Neutral", CSS variables : Yes.

Puis installer les composants nécessaires pour le bootstrap :

```bash
npx shadcn@latest add button input label card
```

- [ ] **Step 4 : Créer `src/app/(auth)/layout.tsx`**

```tsx
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5 : Créer `src/app/(auth)/signin/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.magicLink({
        email,
        callbackURL: '/',
      });
      if (error) {
        setError(error.message ?? 'Erreur lors de l\'envoi du lien');
      } else {
        router.push(`/verify?email=${encodeURIComponent(email)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Reçois un lien magique par email pour te connecter.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading || !email} className="w-full">
            {loading ? 'Envoi...' : 'Recevoir le lien'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6 : Créer `src/app/(auth)/verify/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vérifie ta boîte mail</CardTitle>
        <CardDescription>
          {email
            ? `Un lien de connexion a été envoyé à ${email}.`
            : 'Un lien de connexion vient d\'être envoyé.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600">
          Pense à regarder dans tes spams. Le lien expire dans 10 minutes.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7 : Smoke boot**

```bash
npm run dev
```

Visiter `http://localhost:3000` → redirect vers `/signin`. Page de signin s'affiche avec input email. Tuer.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "🤖 feat(auth): pages signin + verify + Tailwind v4 + shadcn"
git push
```

---

## Task 10 : Dashboard protégé + logout

**Files :**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/components/layout/app-header.tsx`

- [ ] **Step 1 : Créer `src/components/layout/app-header.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';

export function AppHeader({ name, email }: { name: string | null; email: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push('/signin');
  }

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">content-os</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600">{name ?? email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Se déconnecter
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2 : Créer `src/app/(app)/layout.tsx`**

```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { AppHeader } from '@/components/layout/app-header';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <div className="min-h-screen bg-neutral-50">
      <AppHeader name={session.user.name ?? null} email={session.user.email} />
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3 : Créer `src/app/(app)/page.tsx`**

```tsx
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const displayName = session?.user.name ?? session?.user.email ?? 'inconnu';

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Bienvenue, {displayName}</h2>
      <p className="text-neutral-600">
        Ton instance content-os est prête. Les fonctionnalités arriveront dans les prochains sprints.
      </p>
    </div>
  );
}
```

- [ ] **Step 4 : Smoke check (manuel)**

```bash
npm run dev
```

Visiter `http://localhost:3000` → redirect `/signin`. (Pas de test du flow complet ici, ce sera l'objet du E2E en Task 12.)

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "🤖 feat(app): dashboard protégé + header + logout"
git push
```

---

## Task 11 : Endpoints de test (__test__/emails) + jobs/[id]

**Files :**
- Create: `src/app/api/__test__/emails/route.ts`, `src/app/api/jobs/[id]/route.ts`

- [ ] **Step 1 : Créer `src/app/api/__test__/emails/route.ts`**

```ts
import { getEmailSender } from '@/lib/email/send';

export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'test') {
    return new Response('Not found', { status: 404 });
  }
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  const sender = getEmailSender();
  const inbox = sender.inbox?.(to) ?? [];
  return Response.json({ emails: inbox });
}

export async function DELETE(): Promise<Response> {
  if (process.env.NODE_ENV !== 'test') {
    return new Response('Not found', { status: 404 });
  }
  getEmailSender().clear?.();
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 2 : Créer `src/app/api/jobs/[id]/route.ts`**

```ts
import { dummyQueue } from '@/lib/queue/client';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const job = await dummyQueue.getJob(id);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
  const state = await job.getState();
  return Response.json({
    id: job.id,
    queue: 'dummy',
    status: state,
    progress: job.progress,
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
  });
}
```

- [ ] **Step 3 : Smoke check des endpoints test**

```bash
NODE_ENV=test npm run dev
```

Dans un autre terminal :

```bash
curl -s http://localhost:3000/api/__test__/emails?to=foo@test.com
# attendu : {"emails":[]}

curl -s -X DELETE http://localhost:3000/api/__test__/emails -w "%{http_code}\n"
# attendu : 204
```

Puis tuer le serveur et redémarrer sans NODE_ENV=test :

```bash
npm run dev
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/__test__/emails?to=foo@test.com
# attendu : 404
```

Tuer.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "🤖 feat(api): endpoints test/emails + jobs/[id]"
git push
```

---

## Task 12 : E2E test signup → dashboard → logout (Playwright)

**Files :**
- Create: `playwright.config.ts`, `test/e2e/auth.spec.ts`
- Modify: `package.json` (test:e2e script)

- [ ] **Step 1 : Installer Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2 : Créer `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      timeout: 60_000,
      reuseExistingServer: false,
      env: { NODE_ENV: 'test' },
    },
    {
      command: 'npm run worker',
      url: 'http://localhost:3000',  // sert juste de health probe partagé
      reuseExistingServer: false,
      env: { NODE_ENV: 'test' },
    },
  ],
});
```

- [ ] **Step 3 : Ajouter script E2E dans `package.json`**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 4 : Créer `test/e2e/auth.spec.ts`**

```ts
import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = `playwright-${Date.now()}@test.invalid`;

async function fetchMagicLink(page: Page, email: string): Promise<string> {
  // Poll l'endpoint __test__/emails jusqu'à obtenir un email pour cette adresse
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Magic link not found in email html');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Magic link email never arrived');
}

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    // Cleanup l'inbox in-memory entre tests
    await page.request.delete('/api/__test__/emails');
  });

  test('signup → magic link → dashboard → logout', async ({ page }) => {
    // 1. La racine redirige vers /signin
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);

    // 2. Remplir email et submit
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/verify/);

    // 3. Récupérer le magic link via l'endpoint test
    const magicUrl = await fetchMagicLink(page, TEST_EMAIL);

    // 4. Visiter le magic link → arrive sur le dashboard
    await page.goto(magicUrl);
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Bienvenue/)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    // 5. Logout
    await page.click('button:has-text("Se déconnecter")');
    await expect(page).toHaveURL(/\/signin$/);

    // 6. Tenter d'accéder à / sans session → redirect
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
  });
});
```

- [ ] **Step 5 : Préparer la DB de test et build l'app**

```bash
# Démarrer postgres et redis si pas déjà fait
docker compose up -d

# S'assurer que les migrations sont appliquées
NODE_ENV=test npm run db:migrate

# Build (pour `next start`)
npm run build
```

- [ ] **Step 6 : Run le E2E**

```bash
npm run test:e2e
```

Attendu : 1 test passe. Si fail, lire le report (`npx playwright show-report`), corriger, relancer.

⚠️ Si le test fail avec "Magic link email never arrived", c'est probable que `NODE_ENV` n'est pas correctement propagé à Next.js prod via `npm start`. Solution : utiliser `cross-env NODE_ENV=test next start` au lieu de juste `next start`. Installer `cross-env` (`npm i -D cross-env`) et ajuster le script `start` dans package.json.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "🤖 test(e2e): auth flow signup → dashboard → logout via Playwright"
git push
```

---

## Task 13 : CI GitHub Actions

**Files :**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1 : Créer `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

env:
  NODE_VERSION: '22'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit
        env:
          NODE_ENV: test
          APP_URL: http://localhost:3000
          DATABASE_URL: postgres://app:app@localhost:5432/contentos
          REDIS_URL: redis://localhost:6379
          BETTER_AUTH_SECRET: ci-secret-not-used-in-unit-tests-but-required

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
          POSTGRES_DB: contentos_test
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U app -d contentos_test"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=5
    env:
      NODE_ENV: test
      APP_URL: http://localhost:3000
      DATABASE_URL: postgres://app:app@localhost:5432/contentos_test
      REDIS_URL: redis://localhost:6379
      BETTER_AUTH_SECRET: ci-secret-32-chars-min-aaaaaaaa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration

  worker:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: contentos_test }
        ports: ['5432:5432']
        options: --health-cmd="pg_isready -U app" --health-interval=5s --health-retries=5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: --health-cmd="redis-cli ping" --health-interval=5s --health-retries=5
    env:
      NODE_ENV: test
      APP_URL: http://localhost:3000
      DATABASE_URL: postgres://app:app@localhost:5432/contentos_test
      REDIS_URL: redis://localhost:6379
      BETTER_AUTH_SECRET: ci-secret-32-chars-min-aaaaaaaa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:worker

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: contentos_test }
        ports: ['5432:5432']
        options: --health-cmd="pg_isready -U app" --health-interval=5s --health-retries=5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: --health-cmd="redis-cli ping" --health-interval=5s --health-retries=5
    env:
      NODE_ENV: test
      APP_URL: http://localhost:3000
      DATABASE_URL: postgres://app:app@localhost:5432/contentos_test
      REDIS_URL: redis://localhost:6379
      BETTER_AUTH_SECRET: ci-secret-32-chars-min-aaaaaaaa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run db:migrate
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

- [ ] **Step 2 : Push et vérifier CI**

```bash
git add -A
git commit -m "🤖 ci: GitHub Actions 5 jobs (lint, unit, integration, worker, e2e)"
git push
```

Aller sur GitHub → Actions tab → vérifier que les 5 jobs passent vert. Si échec, lire les logs, corriger, repush.

⚠️ Si un job fail sur la première run pour des raisons d'environnement (npm cache miss, service not ready), c'est probablement transitoire. Relancer le job avant d'investiguer.

---

## Task 14 : README onboarding

**Files :**
- Modify: `README.md` (créé par create-next-app, à remplacer complètement)

- [ ] **Step 1 : Remplacer `README.md`**

```markdown
# content-os

SaaS d'aide à la création de contenu éditorial pour LinkedIn, piloté par IA. Une instance par créateur, auto-hébergeable.

## Stack

- **Framework** : Next.js 16 (App Router) + TypeScript strict
- **DB** : Postgres 16 + Drizzle ORM
- **Auth** : Better-Auth (magic link via Resend)
- **Queue** : BullMQ (Redis)
- **Storage** : Cloudflare R2 (S3-compatible, swappable)
- **UI** : Tailwind v4 + shadcn/ui
- **Tests** : Vitest + Playwright
- **Lint** : Biome
- **Conteneurs** : Docker Compose (dev), à compléter pour prod

## Pré-requis

- Node 22+
- Docker Desktop
- Un compte Resend ([resend.com](https://resend.com)) pour les emails de connexion en prod
  - Pas obligatoire en dev : sans `RESEND_API_KEY`, les emails atterrissent dans un buffer in-memory (testable via `/api/__test__/emails` en `NODE_ENV=test`)
- Un bucket Cloudflare R2 pour le storage en prod
  - Pas obligatoire en dev : sans `R2_ACCOUNT_ID`, un storage in-memory est utilisé

## Setup local

```bash
git clone git@github.com:<org>/content-os-v2.git
cd content-os-v2
npm install

# Variables d'env
cp .env.example .env
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
# Optionnel : remplir RESEND_API_KEY + R2_* dans .env si tu veux tester en réel

# Services de dev
docker compose up -d

# Migrations
npm run db:migrate

# Démarrer Next.js (terminal 1)
npm run dev

# Démarrer le worker (terminal 2)
npm run worker
```

Ou tout en un avec :

```bash
npm run dev:all
```

Ouvrir [http://localhost:3000](http://localhost:3000) → page de signin. Saisir un email → cliquer le lien magique reçu dans la console (ou dans Resend si configuré).

## Tests

```bash
npm run lint           # Biome
npm run test:unit      # Vitest, pas de services
npm run test:integration  # Vitest + Postgres
npm run test:worker    # Vitest + Postgres + Redis
npm run test:e2e       # Playwright + stack complète
npm test               # Tout sauf E2E
```

## Scripts utiles

```bash
npm run db:generate     # générer une nouvelle migration depuis le schema Drizzle
npm run db:migrate      # appliquer les migrations en attente
npm run db:studio       # ouvrir Drizzle Studio (GUI DB) sur :4983
npm run format          # auto-format Biome
```

## Architecture

Voir `docs/architecture.md` (à venir).

Référence design : [Spec architecture cible v2](https://github.com/<org>/content-os-v2/blob/main/docs/spec-architecture-v2.md) (à porter dans ce repo).

## Déploiement

À documenter en Spec 8 (polish + observability + déploiement). Cible : Docker Compose prod avec services `web` + `worker` + `postgres` + `redis`, derrière Caddy/Traefik/Coolify pour TLS.

## Contribution

- Branches : `feat/*`, `fix/*`, `chore/*`
- Commits : messages descriptifs avec emoji `🤖` quand co-écrit avec Claude
- PR template : à créer
- CI doit être verte avant merge

## Licence

À définir.
```

- [ ] **Step 2 : Commit**

```bash
git add README.md
git commit -m "🤖 docs: README onboarding"
git push
```

- [ ] **Step 3 : Vérifier critères de réussite finaux**

Run dans l'ordre depuis un clone frais :

```bash
cd /tmp
git clone git@github.com:<org>/content-os-v2.git
cd content-os-v2
npm install
cp .env.example .env
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d
sleep 10
npm run db:migrate
npm test
npm run test:e2e
```

Attendu : tout passe vert. Sinon, ajuster le README ou les scripts pour correspondre exactement au flow décrit.

- [ ] **Step 4 : Commit final si ajustements**

```bash
git add -A
git commit -m "🤖 chore: tweaks finaux pour clone-and-go fonctionnel"
git push
```

---

## Self-Review

**Spec coverage** :
- ✅ Structure repo (Task 1, 2)
- ✅ Schema DB (Task 3)
- ✅ Seed factory au signup (Task 8, hook databaseHooks)
- ✅ Auth magic link via Resend (Task 8, 9)
- ✅ Email service Resend + InMemory + factory (Task 6)
- ✅ Storage adapter R2 + InMemory + factory (Task 5)
- ✅ Queue BullMQ + worker dummy (Task 7)
- ✅ Endpoints (auth, jobs, __test__/emails) (Task 8, 11)
- ✅ Pages signin + verify + dashboard + logout (Task 9, 10)
- ✅ Middleware session guard (Task 8)
- ✅ Compose dev (Task 2)
- ✅ Tests 4 layers (Task 4, 5, 6, 7, 12)
- ✅ Tenant isolation sentinelle (Task 4)
- ✅ CI GitHub Actions 5 jobs (Task 13)
- ✅ README onboarding (Task 14)
- ✅ Critères de réussite vérifiés à la fin (Task 14 Step 3)

**Placeholder scan** :
- Pas de "TBD", "TODO", "fill in details", "similar to Task N", "add appropriate error handling" non-traités.
- 1 note ⚠️ explicite sur Better-Auth (vérifier l'API exacte). C'est une garde sur la fragilité d'une API externe en évolution rapide, pas un placeholder de plan.
- 1 note ⚠️ explicite sur cross-env (potentiel besoin selon comportement Next start). Documenté en plan B exécutable.

**Type consistency** : `EmailMessage`, `EmailSender`, `Storage`, `Settings`, `User` cohérents partout. Signatures (`upload`, `signedUrl`, `delete`, `exists`, `send`, `inbox`, `clear`) identiques entre interface et impls et tests. Paramètres `userId` en premier dans toutes les repository functions.

**Couverture critères spec** : les 12 critères de réussite du spec sont tous couverts par des étapes du plan (vérifiables par smoke check ou par tests).

Plan complet et auto-suffisant. Un sous-agent exécutant une task isolée a tout le code et les commandes nécessaires.
