# Spec 1 — Bootstrap content-os-v2

Date : 2026-05-22
Statut : design validé, à implémenter
Référence parent : [`2026-05-22-architecture-cible-v2-design.md`](./2026-05-22-architecture-cible-v2-design.md)

## Contexte

Premier sous-projet de la refonte v2. Met en place le squelette technique d'un nouveau repo `content-os-v2` (sur GitHub, séparé du v1 actuel sur Gitea). Pose Next.js + Drizzle + Better-Auth + BullMQ + Storage adapter + tests + CI, avec un seul flow utilisateur fonctionnel de bout en bout : signup magic link → dashboard vide → logout. Tout le reste (métier, API, MCP, publication) est l'affaire des Specs 2 à 8.

**Objectif tangible** : un repo où `docker compose up` + `npm install` + `npm run db:migrate` + `npm run dev` donnent une instance fonctionnelle, et où `npm test` + CI GitHub Actions tournent vert sur les 5 layers (lint, unit, integration, worker, E2E).

## Décisions

- **Repo** : nouveau dépôt GitHub (org et nom exact à fixer au moment du `gh repo create`). Sibling du repo v1 actuel, pas de fork ni de réécriture in-place. Clean slate complet.
- **Layout** : monolith Next.js (un seul `package.json`). Web et worker partagent le code via imports relatifs depuis `src/lib/`. Bascule en monorepo plus tard si justifié (YAGNI).
- **Auth** : Better-Auth + plugin magic link uniquement. Pas de password, pas d'OAuth. SMTP via Resend partout (dev + prod), avec fallback in-memory pour les tests.
- **Compose dev** : 2 services seulement (postgres + redis). Next et worker tournent natifs sur l'hôte pour HMR optimal.
- **Tailwind v4** + shadcn/ui. Pas de design system custom au démarrage.
- **Migrations Drizzle versionnées** (`drizzle-kit generate` → fichiers SQL commités), appliquées via `drizzle-kit migrate` en dev/CI/prod.

## Structure du repo

```
content-os-v2/
├── .github/workflows/
│   └── ci.yml                 # 5 jobs parallèles
├── docker/
│   ├── compose.yml            # services dev : postgres, redis
│   └── postgres-init.sql      # extensions (uuid-ossp si besoin)
├── drizzle/
│   └── 0000_initial.sql       # migrations versionnées commitées
├── public/                    # statics Next.js
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── signin/page.tsx
│   │   │   └── verify/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx     # shell : header + main slot
│   │   │   └── page.tsx       # dashboard "Bienvenue $name"
│   │   ├── api/
│   │   │   ├── auth/[...all]/route.ts       # Better-Auth handler
│   │   │   ├── jobs/[id]/route.ts            # polling job status
│   │   │   └── __test__/emails/route.ts      # gardé par NODE_ENV=test
│   │   ├── globals.css        # Tailwind v4 + tokens
│   │   └── layout.tsx         # root layout
│   ├── worker/
│   │   ├── index.ts           # entrypoint worker
│   │   └── queues/
│   │       └── dummy.ts       # 1 job smoke-test
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts      # Drizzle client
│   │   │   ├── schema.ts      # toutes les tables
│   │   │   └── repositories/
│   │   │       └── settings.ts # scoping user_id
│   │   ├── auth/
│   │   │   ├── server.ts      # Better-Auth instance
│   │   │   └── client.ts      # hooks client React
│   │   ├── queue/
│   │   │   ├── client.ts      # Queue instances
│   │   │   └── enqueue.ts     # helpers
│   │   ├── storage/
│   │   │   ├── types.ts       # interface Storage
│   │   │   ├── r2.ts          # impl Cloudflare R2 (S3 SDK)
│   │   │   ├── in-memory.ts   # impl pour tests
│   │   │   └── index.ts       # factory dispatch
│   │   ├── email/
│   │   │   ├── types.ts       # interface EmailSender
│   │   │   ├── resend.ts      # impl Resend SDK
│   │   │   ├── in-memory.ts   # impl pour tests
│   │   │   └── send.ts        # factory + helper sendEmail
│   │   └── env.ts             # validation env vars (zod)
│   ├── middleware.ts          # session guard sur (app)/...
│   └── components/
│       ├── ui/                # shadcn/ui generated
│       └── layout/
│           └── app-header.tsx # header + bouton logout
├── test/
│   ├── unit/
│   ├── integration/
│   │   ├── settings-repository.test.ts
│   │   └── tenant-isolation.test.ts   # sentinelle (vraie en Spec 2+)
│   ├── worker/
│   │   └── dummy.test.ts
│   └── e2e/
│       └── auth.spec.ts       # signup → magic link → dashboard → logout
├── .env.example
├── biome.json
├── docker-compose.yml         # raccourci vers docker/compose.yml
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── playwright.config.ts
├── README.md                  # onboarding + dev workflow
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

Convention : tout sous `src/lib/` est partagé entre `src/app/` (web) et `src/worker/`. Imports toujours `app/` ou `worker/` → `lib/`, jamais l'inverse.

## Schema DB initial

Minimum vital pour bootstrap : tables Better-Auth + 1 table métier (`settings`) pour valider le pattern singleton-per-user et le test d'isolation. Le schema complet métier (ideas, posts, publications, media, voice, etc.) vient en Spec 2.

```ts
// src/lib/db/schema.ts

// Better-Auth tables (déclarées manuellement dans Drizzle, alignées sur Better-Auth)
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
  identifier: text('identifier').notNull(),    // email
  value: text('value').notNull(),               // token magic link
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Métier minimal : 1 singleton par user, valide le pattern
export const settings = pgTable('settings', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull().default(''),
  brandColor: text('brand_color').notNull().default('#000000'),
  brandSignature: text('brand_signature').notNull().default(''),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Seed factory au signup** : hook `databaseHooks.user.create.after` de Better-Auth crée la row `settings` vide pour le nouveau user. Même pattern qui sera étendu en Spec 2 pour seeder voice, visual_briefing, et le writing_template par défaut.

**Repository pattern** : `src/lib/db/repositories/settings.ts` expose `getSettings(userId)` et `updateSettings(userId, patch)`. Toutes les fonctions reçoivent `userId` en **premier paramètre** — convention sentinelle pour le scoping multi-tenant qu'on grep facilement.

**Migrations** : `npm run db:generate` produit `drizzle/0000_initial.sql` versionné et commité. `npm run db:migrate` applique en dev/CI/prod.

## Auth flow magic link via Resend

### Serveur

```ts
// src/lib/auth/server.ts
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client';
import { sendEmail } from '../email/send';
import { settings } from '../db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  plugins: [
    magicLink({
      expiresIn: 600, // 10 min
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: 'Connexion à content-os',
          html: `<p>Clique ici pour te connecter : <a href="${url}">${url}</a></p><p>Lien valable 10 minutes.</p>`,
        });
      },
    }),
  ],
  trustedOrigins: [process.env.APP_URL!],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.insert(settings).values({ userId: user.id }).onConflictDoNothing();
        },
      },
    },
  },
});
```

### Email service

Abstraction stable derrière une interface, dispatch selon env. **Resend** en runtime (dev + prod), **InMemory** en tests.

```ts
// src/lib/email/types.ts
export interface EmailSender {
  send(opts: { to: string; subject: string; html: string }): Promise<void>;
  // helpers tests uniquement (impl par InMemory)
  inbox?(to: string): Array<{ to: string; subject: string; html: string }>;
  clear?(): void;
}

// src/lib/email/resend.ts
import { Resend } from 'resend';
export class ResendEmailSender implements EmailSender {
  private resend: Resend;
  constructor(apiKey: string, private from: string) { this.resend = new Resend(apiKey); }
  async send(opts) { await this.resend.emails.send({ from: this.from, ...opts }); }
}

// src/lib/email/in-memory.ts
export class InMemoryEmailSender implements EmailSender {
  private store: Array<{ to: string; subject: string; html: string }> = [];
  async send(opts) { this.store.push(opts); }
  inbox(to: string) { return this.store.filter((e) => e.to === to); }
  clear() { this.store = []; }
}

// src/lib/email/send.ts
let instance: EmailSender;
export function getEmailSender(): EmailSender {
  if (instance) return instance;
  if (process.env.NODE_ENV === 'test' || !process.env.RESEND_API_KEY) {
    instance = new InMemoryEmailSender();
  } else {
    instance = new ResendEmailSender(
      process.env.RESEND_API_KEY,
      process.env.RESEND_FROM ?? 'onboarding@resend.dev',
    );
  }
  return instance;
}
export const sendEmail = (opts) => getEmailSender().send(opts);
```

### Endpoint de test

`src/app/api/__test__/emails/route.ts` — actif uniquement si `NODE_ENV === 'test'`, sinon 404. Permet aux E2E Playwright de récupérer les emails du store in-memory et de cleanup entre tests.

```ts
import { getEmailSender } from '@/lib/email/send';

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'test') return new Response('Not found', { status: 404 });
  const url = new URL(req.url);
  const to = url.searchParams.get('to') ?? '';
  return Response.json({ emails: getEmailSender().inbox?.(to) ?? [] });
}

export async function DELETE() {
  if (process.env.NODE_ENV !== 'test') return new Response('Not found', { status: 404 });
  getEmailSender().clear?.();
  return new Response(null, { status: 204 });
}
```

### Pages

- `src/app/(auth)/signin/page.tsx` : form `<input type="email">` + bouton "Recevoir le lien". Server Action appelle `auth.api.signInMagicLink({ email })`.
- `src/app/(auth)/verify/page.tsx` : message "Vérifie ta boîte mail" + aide ("regarde aussi tes spams").
- `src/app/(app)/page.tsx` : dashboard protégé. Affiche "Bienvenue, $name" (ou email si name vide), bouton "Se déconnecter" → `auth.api.signOut()` + redirect `/signin`.

### Middleware

```ts
// src/middleware.ts
import { auth } from '@/lib/auth/server';

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.redirect(new URL('/signin', request.url));
}

export const config = {
  matcher: ['/((?!signin|verify|api/auth|api/__test__|_next).*)'],
};
```

## Docker Compose dev

```yaml
# docker/compose.yml
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

**Workflow dev** :
```bash
docker compose -f docker/compose.yml up -d   # postgres + redis
npm run dev                                   # next dev sur :3000 (terminal 1)
npm run worker                                # tsx watch worker (terminal 2)
# OU
npm run dev:all                               # via concurrently
```

`npm scripts` :
```json
{
  "scripts": {
    "dev": "next dev",
    "worker": "tsx watch --env-file=.env src/worker/index.ts",
    "dev:all": "concurrently -n web,worker -c blue,magenta 'next dev' 'npm run worker'",
    "build": "next build",
    "start": "next start",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run && playwright test",
    "test:unit": "vitest run test/unit",
    "test:integration": "vitest run test/integration",
    "test:worker": "vitest run test/worker",
    "test:e2e": "playwright test",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

## Storage adapter

Interface stable + 2 implems (R2 + InMemory). Spec 1 ne consomme pas le storage en runtime (pas de média encore), mais l'infra est posée pour Spec 5.

```ts
// src/lib/storage/types.ts
export interface Storage {
  upload(opts: { key: string; body: Buffer | Uint8Array; contentType: string }): Promise<void>;
  signedUrl(opts: { key: string; expiresInSeconds?: number }): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

**Impl R2** : `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` configurés contre `https://<account_id>.r2.cloudflarestorage.com`. Credentials via `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, bucket via `R2_BUCKET`.

**Impl InMemory** : Map keyée par `key`. `signedUrl` retourne `https://test.invalid/<key>?expires=<ts>`. Expose `get(key)` pour les assertions de tests.

**Factory** : `src/lib/storage/index.ts` dispatch. `NODE_ENV === 'test'` ou absence de `R2_ACCOUNT_ID` → InMemory ; sinon R2. Singleton process-level.

**Test Spec 1** : 1 fichier `test/unit/storage.test.ts` qui valide InMemory upload/signedUrl/delete/exists. Pas de test R2 réel (ce serait flaky et coûteux ; on testera R2 en Spec 5 via une vraie clé scellée en secret CI).

## Queue setup

**Pas de jobs métier en Spec 1**. On pose juste l'infra avec 1 file `dummy` pour valider que enqueue + consume + result fonctionnent end-to-end.

```ts
// src/lib/queue/client.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const dummyQueue = new Queue<{ message: string }, { ok: true; echoed: string }>(
  'dummy', { connection }
);

// src/lib/queue/enqueue.ts
export async function enqueueDummy(message: string) {
  const job = await dummyQueue.add('echo', { message });
  return job.id!;
}
```

```ts
// src/worker/index.ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processDummy } from './queues/dummy';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const workers = [
  new Worker('dummy', processDummy, { connection, concurrency: 4 }),
];

console.log(`[worker] ${workers.length} consumer(s) ready`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, closing...`);
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

```ts
// src/worker/queues/dummy.ts
import { Job } from 'bullmq';

export async function processDummy(job: Job<{ message: string }>) {
  console.log(`[dummy] processing job ${job.id} : ${job.data.message}`);
  return { ok: true, echoed: job.data.message };
}
```

**Endpoint polling** : `src/app/api/jobs/[id]/route.ts` retourne `{ id, queue, status, progress, result, error }` pour un `dummyQueue.getJob(id)`. Pattern à étendre en Spec 4+ pour dispatcher sur multiple queues.

**Test worker** : `test/worker/dummy.test.ts` enqueue → attend la completion → vérifie le retour. Le test launcher démarre un Worker en background avant les tests, le tue après (pattern formalisé dans le plan d'implémentation).

**Pas de Bull-Board en Spec 1** (Spec 8 polish).

## CI GitHub Actions

`.github/workflows/ci.yml`, 5 jobs parallèles.

- `lint` : Biome check
- `unit` : Vitest, pas de services
- `integration` : Vitest + service container Postgres
- `worker` : Vitest + service containers Postgres + Redis
- `e2e` : Playwright + service containers + `npm run build` + `npm start` + worker, le tout démarré par la config `playwright.config.ts` (option `webServer`)

**Variables CI** :
- `NODE_ENV=test` partout → fallback InMemory pour email et storage
- `DATABASE_URL=postgres://app:app@localhost:5432/contentos_test`
- `REDIS_URL=redis://localhost:6379`
- `APP_URL=http://localhost:3000`

**Pas de secrets requis pour Spec 1** : pas de `RESEND_API_KEY`, ni `R2_*`, ni `ANTHROPIC_API_KEY`. Le mode test couvre tout via les impls in-memory et le worker dummy.

**Merge protection** : configurer côté GitHub repository settings → `main` requires les 5 jobs passing. À documenter dans le README.

## Tests pour Spec 1

| Fichier | Layer | Couvre |
|---|---|---|
| `test/unit/storage.test.ts` | unit | InMemoryStorage upload/get/exists/delete |
| `test/unit/email.test.ts` | unit | InMemoryEmailSender send/inbox/clear |
| `test/integration/settings-repository.test.ts` | integration | getSettings, updateSettings, scoping userId |
| `test/integration/tenant-isolation.test.ts` | integration | Sentinelle : user A ne lit/écrit pas settings de user B |
| `test/worker/dummy.test.ts` | worker | Enqueue + consume + result round-trip |
| `test/e2e/auth.spec.ts` | e2e | Signup magic link → dashboard → logout → guard middleware |

Pas d'objectif coverage chiffré. La suite démarre minimale, s'étoffe à chaque Spec.

## Critères de réussite

1. `git clone <repo> && cd content-os-v2 && npm install` réussit sur Node 22.
2. Copier `.env.example` vers `.env`, remplir `RESEND_API_KEY` + `R2_*` (ou laisser vide pour fallback in-memory) → l'app boote.
3. `docker compose -f docker/compose.yml up -d` lance postgres + redis healthy.
4. `npm run db:migrate` crée les 5 tables (user, session, account, verification, settings).
5. `npm run dev` démarre Next.js sur :3000, `npm run worker` démarre le consumer dummy.
6. Aller sur `http://localhost:3000` → redirect vers `/signin`.
7. Saisir email + submit → email reçu (Resend si clé fournie, sinon InMemory en dev `NODE_ENV=test`).
8. Cliquer le magic link → arrivée sur `/`, message "Bienvenue, $email", bouton "Se déconnecter" visible.
9. Cliquer "Se déconnecter" → redirect `/signin`, re-tenter `/` redirect `/signin`.
10. `npm test` exécute lint + unit + integration + worker + E2E, **tout vert**.
11. Push sur GitHub → CI Actions exécute les 5 jobs en parallèle, **tout vert**.
12. README onboarding lisible par un dev externe en 10 minutes (du `git clone` au "premier user connecté").

## Hors-scope

- Tables métier autres que `settings` (ideas, posts, media, voice, etc.) → Spec 2.
- Vraies UI au-delà du dashboard "Bienvenue" → Spec 3+.
- Vrais jobs métier (génération, publication) → Spec 4+.
- Dockerfile prod multi-stage → Spec 8.
- Sentry, logs structurés, Bull-Board, rate-limiting → Spec 8.
- API REST / MCP server → Spec 7.
- OAuth providers autres que magic link → hors scope global v2 sauf demande future.
- Migration de données depuis v1 → Spec 9 optionnel.

## Décisions en suspens

- **Nom exact du repo GitHub** (`content-os-v2`, `content-os`, autre) et org de destination (perso ou nouvelle org). Tu décides au moment du `gh repo create`, je nomme le dossier local pareil dans le plan d'implémentation.
- **Email "from" de Resend** : `onboarding@resend.dev` par défaut (pas besoin de domaine vérifié), à remplacer par ton domaine vérifié quand tu en as un.
- **Logo/favicon** : placeholder neutre au démarrage, customisable plus tard.
- **Configuration de merge protection sur GitHub** : à activer manuellement après le premier push, pas automatisable depuis le code.
