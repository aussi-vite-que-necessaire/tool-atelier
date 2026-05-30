# Architecture cible v2 — content-os SaaS multi-tenant

Date : 2026-05-22
Statut : design validé, à décomposer en sous-specs

## Contexte

Le prototype actuel (`content-os` v1, TypeScript/Hono/HTMX/SQLite/Puppeteer in-process) a démontré la valeur métier : voix éditoriale + templates d'écriture + pipeline IA + templates visuels rendus en PNG + publication LinkedIn. Mais le shell technique craque : pas d'auth, génération synchrone bloquante, single-user mono-instance, pas de tests, bugs d'intégration, état DB fragile. Tout ce qui n'est pas le métier (web framework, DB, queue, storage, tests) doit être remplacé par une stack moderne.

Ce spec définit l'architecture cible de la v2 : une SaaS multi-tenant solide, auto-hébergeable, conçue pour absorber les futures features (carousels, vidéos, plus de plateformes) sans refactor structurel.

## Décisions fondatrices

- **SaaS multi-tenant** : un seul déploiement, plusieurs users authentifiés. Chaque user a son propre espace (ideas, posts, templates, voice, settings). Le modèle "1 instance par créateur" de la v1 est abandonné.
- **Tenant = user** : pas de workspaces/organizations au démarrage. Schema scope par `user_id`. Migration future vers organisations possible mais hors scope.
- **Clean slate** : nouveau repo (`content-os-v2` ou réécriture complète de la branche main). Pas de strangler. Les fichiers à haute valeur (templates visuels, prompts, styleguides, voice.md) sont copiés en early-step.
- **Self-host portable** : tout en Docker. Cloudflare R2 comme storage par défaut (S3-compat, swappable vers MinIO/S3/Backblaze sans changer le code). Pas de dépendance Vercel.

## Stack

| Couche | Choix | Rôle |
|---|---|---|
| Framework | Next.js 16 App Router | Web fullstack (UI + Server Actions + Route Handlers) |
| Language | TypeScript strict, ESM | — |
| ORM | Drizzle | Schema en TS, SQL visible, migrations versionées |
| DB | Postgres 16 (Docker) | Source de vérité, transactions, JSONB |
| Auth | Better-Auth | Email/password + magic links, pas de plugin orgs |
| Queue | BullMQ (Redis) | Jobs longs : génération de post, génération de média, publication |
| Storage | Cloudflare R2 (S3-compat) | PNG, uploads users. Adapter Storage swappable. |
| UI | shadcn/ui + Tailwind 4 | Composants accessibles, design tokens |
| Tests | Vitest + Playwright | Unit + integration + worker + E2E |
| Lint/format | Biome | Un outil au lieu d'ESLint + Prettier |
| MCP | `@modelcontextprotocol/sdk` HTTP streamable | Exposé en Route Handler Next.js, auth bearer token |
| Render visuels | Puppeteer | Singleton browser dans le worker, jamais dans le web |
| IA texte | `@anthropic-ai/sdk` | Inchangé v1 |
| IA image | `@google/genai` | Inchangé v1 |
| Logs | pino structuré | Sentry optionnel |
| Containerisation | Docker Compose | Services : web, worker, postgres, redis |

## Architecture services

5 services orchestrés via Docker Compose (4 internes + 1 externe R2) :

```
┌─────────────────┐         ┌─────────────────┐
│  web (Next.js)  │◄────────│  user browser   │
│  - UI pages     │         │  Claude Desktop │──┐
│  - Server Acts  │         │  curl/API       │  │
│  - REST + MCP   │         └─────────────────┘  │
│  - 0 job lourd  │◄──────────────────────────────┘
└────────┬────────┘    HTTP (MCP streamable / REST)
         │
         │ enqueue jobs        ┌──────────────────┐
         ├─────────────────────►   redis (BullMQ) │
         │                      └──────────┬───────┘
         │ read/write DB                   │ pop jobs
         ▼                                 ▼
   ┌──────────┐                  ┌────────────────────┐
   │ postgres │◄─────────────────│  worker (tsx)      │
   │          │  read context    │  - generate-post   │
   │          │  write results   │  - generate-media  │
   │          │                  │  - publish-post    │
   │          │                  │  - puppeteer       │
   └──────────┘                  └──────────┬─────────┘
                                            │ upload PNG / signed URLs
                                            ▼
                                  ┌──────────────────┐
                                  │  R2 (Cloudflare) │
                                  └──────────────────┘
```

**web** : Next.js. Sert UI et endpoints API/MCP. Jamais d'appel IA synchrone bloquant. Enqueue les jobs et retourne immédiatement un `job_id` pour polling.

**worker** : process Node séparé (`tsx src/worker/index.ts`). Image Docker partagée avec `web`, juste un entrypoint différent. Consomme 3 files BullMQ. Singleton Puppeteer dans ce process. SIGTERM/SIGINT déclenchent un shutdown propre.

**postgres** : source de vérité. Toutes les entités + tokens auth chiffrés.

**redis** : BullMQ uniquement (pas de cache applicatif au démarrage).

**R2** : binaires (PNG visuels, uploads users). URLs signées générées on-demand depuis le `web`. Adapter `Storage` côté app avec interface stable (`upload`, `signedUrl`, `delete`), implémentation S3 SDK contre endpoint R2. Migration future vers S3/MinIO = changer endpoint + credentials.

**Communication temps réel UI** : polling toutes 2 secondes du statut du job, à l'aide d'un endpoint `GET /api/jobs/:id`. SSE en upgrade plus tard.

## Modèle de données

Schema Drizzle, scoping `user_id` partout sauf les tables singleton par user (clé primaire = `user_id`).

```ts
// gérées par Better-Auth
users          (id, email, name, image, created_at, ...)
sessions       (id, user_id, expires_at, ...)
accounts       (id, user_id, provider, provider_account_id, ...)

// brand identity du user
settings       (user_id PK, brand_name, brand_color, brand_signature, updated_at)

// éditorial
voice          (user_id PK, content, updated_at)
visual_briefing (user_id PK, content, updated_at)

writing_templates (id, user_id, name, slug, platform, structure, writing_rules, created_at)
visual_styles    (id, user_id, name, slug, prompt, created_at)

// pipeline
ideas       (id, user_id, idea, brief, created_at, updated_at)
posts       (id, user_id, idea_id, writing_template_id, media_id,
             content,
             status: 'draft' | 'validated',
             created_at, updated_at)

// publications : snapshots immuables liés à un post
publications (id, user_id, post_id,
              content_snapshot text NOT NULL,
              media_kind: 'image' | 'carousel' | 'video',
              snapshot_keys text[],            -- 1 entrée image/video, N entrées carousel
              social_account_id, platform,
              status: 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed',
              scheduled_for, scheduled_tz, published_at,
              external_post_id, external_url,
              attempts, last_attempt_at, next_attempt_at,
              failure_kind, last_error,
              created_at, updated_at)

// médias polymorphes
media (id, user_id,
       kind: 'image' | 'carousel' | 'video',
       asset_key,                    -- R2 key principal
       preview_key,                  -- thumbnail R2 (= asset_key pour images)
       width, height,
       created_at, updated_at)

image_assets (media_id PK FK,
              source: 'template' | 'standalone',
              -- si template
              template_slug, vars jsonb,
              -- métadonnées IA (optionnelles, présentes si génération/édition IA)
              ai_brief, ai_source_key, style_id)

-- non créées au démarrage, ajoutées quand les kinds correspondants seront implémentés
carousel_assets (media_id PK FK, template_slug)
carousel_slides (id, carousel_id FK, position int, vars jsonb,
                 ai_brief, ai_source_key, asset_key)

video_assets (media_id PK FK, source, duration_seconds, ...)

// publication
social_accounts (id, user_id, platform, external_id, display_name, avatar_url,
                 access_token_enc, access_token_iv, access_token_expires_at,
                 refresh_token_enc, refresh_token_iv, scopes,
                 status, last_refreshed_at, connected_at, updated_at)

// API/MCP
api_tokens  (id, user_id, name, token_hash, scopes,
             last_used_at, created_at, revoked_at)
```

### Posts et publications : séparation snapshot

Le `post` reste purement éditorial (`draft | validated`, contenu éditable, médias attachables).

La `publication` est un snapshot immuable du couple (contenu + média) destiné à une plateforme/compte précis à un moment donné. Toute la machinerie cycle de vie publication (`scheduled / queued / publishing / published / failed / retry / backoff`) vit sur la publication, pas sur le post.

- N publications par post : publier sur 2 comptes, planifier plusieurs créneaux, garder un historique d'échecs sans polluer le post.
- Snapshot du texte : copie de `posts.content` au moment de la création de la publication.
- Snapshot du média : copie physique du PNG (ou des PNGs pour un carousel) vers `publications/{id}/...png` dans R2. R2 ne facture quasi rien, et la publication devient self-contained (l'user peut éditer/supprimer le média original sans casser la publication).
- "Réessayer après échec" : crée une nouvelle row publication avec snapshot frais depuis le post current. L'historique des échecs est préservé.
- Worker `publish-post` consomme `publications WHERE status IN ('queued', 'scheduled')`. Aucune ambiguïté avec les posts.

### Médias polymorphes (future-proof)

Table de base + tables spécialisées par kind. Permet d'ajouter carousels et vidéos plus tard sans refactor.

- `media` : table de base (id, user_id, kind, asset_key, preview_key, dimensions).
- `image_assets`, `carousel_assets/slides`, `video_assets` : tables spécialisées par kind, en table inheritance via `media_id PK FK`.
- L'enum `kind` démarre avec les 3 valeurs (`image`, `carousel`, `video`) pour ne pas avoir à migrer plus tard. Seul `image_assets` est créée au démarrage. Les autres tables sont ajoutées par migration additive quand on attaquera ces kinds.

`image_assets` couvre 3 cas via `source` binaire :
- `template` : Puppeteer rend depuis HTML + vars, avec image IA optionnelle dans le composite (`ai_brief` set si imagePrompt sur le template).
- `standalone` sans `ai_brief` : upload pur (PNG balancé tel quel).
- `standalone` avec `ai_brief` : IA standalone, ou upload édité IA après coup, ou IA puis cropé. La distinction ne se fait pas via une colonne dédiée — c'est juste "voici la matière courante + le dernier prompt utilisé si tu veux régénérer".

Côté `posts` : `media_id` au lieu de `visual_id`. Un post a 0 ou 1 média attaché, quel que soit son kind. UI dispatche sur `media.kind` pour rendre l'aperçu.

Côté `publications` : `snapshot_keys text[]` couvre les 3 kinds uniformément (1 entrée pour image/video, N pour carousel).

Templates média en code (inchangé du pattern v1) :
- `src/media/image/<slug>/index.ts` (kind=image)
- `src/media/carousel/<slug>/index.ts` (plus tard, kind=carousel, render retourne N pages HTML)
- `src/media/video/<slug>/index.ts` (plus tard, kind=video, ffmpeg ou Remotion)

Renommage cosmétique v1 → v2 : `visuals` → `media`, `visual_id` → `media_id`, `src/visuals/` → `src/media/`, `produceVisual` → `produceMedia`. Le mot "visual" reste dans `visual_styles` qui désigne un style graphique indépendant du kind.

### Multi-tenant safety net

Convention : toute repository function reçoit `userId` comme premier paramètre. `WHERE user_id = $userId` ajouté systématiquement (Drizzle relations + helpers pour minimiser l'oubli).

Test sentinelle obligatoire : `test/integration/tenant-isolation.test.ts` crée deux users, vérifie pour chaque repository function que A ne lit/n'écrit jamais les rows de B.

## Pipeline de génération en queue

3 files BullMQ dans Redis :

| File | Job | Durée | Concurrence | Retries |
|---|---|---|---|---|
| `generate-post` | `write + polish` depuis `idea_id` → crée 1 row `posts` (draft) | 5-15s | 4 | 2 (1m, 5m) |
| `generate-media` | Pipeline visuel selon `kind` + `source` → crée 1 row `media` + assets R2 | 10-40s | 2 | 2 (1m, 5m) |
| `publish-post` | Publication d'une `publications.id` vers LinkedIn → update status | 2-5s | 2 | 3 (5m, 30m, 2h) |

Le `web` n'attend jamais un job lourd. Chaque action HTTP qui déclenche une génération :

1. Valide les inputs.
2. Enqueue le job (payload minimal : juste les IDs DB).
3. Retourne immédiatement `{ job_id, status: 'queued' }`.

**Polling** : `GET /api/jobs/:job_id` retourne `{ id, queue, status: 'pending|active|completed|failed', progress, result, error }`. L'UI poll toutes les 2 secondes pendant qu'un job est actif.

**Pas de pollution des tables métier avec des statuts intermédiaires** : un post n'existe en DB qu'une fois généré (pas de `posts.status = 'generating'`). Pareil pour `media`. Pendant la génération, c'est uniquement un job BullMQ. Si génération fail, rien à nettoyer côté DB.

Exception : `publications` garde son cycle de vie complet en DB (`scheduled → queued → publishing → published/failed`) parce que c'est de l'orchestration métier permanente, pas un job ponctuel.

**Idempotency** : chaque job re-check l'état DB avant d'agir. Si la row attendue existe déjà (post avec content, media avec asset_key, publication avec external_post_id), il skip et marque le job done. Couvre les doubles deliveries BullMQ.

**Worker process** : `tsx src/worker/index.ts` boot tous les consumers en parallèle. Singleton Puppeteer browser dans ce process. SIGTERM/SIGINT déclenchent un `worker.close()` propre.

**Scaling** : `docker compose up --scale worker=3` pour 3 worker processes parallèles, contention zéro via Redis.

**Pas de table `jobs` en DB au démarrage** — BullMQ avec persistence Redis est suffisant pour le MVP. Migration additive plus tard si on veut audit/recovery hors Redis.

**Anti-abuse** : rate-limit côté `web` (X jobs/minute par user). Compteur Redis ou table dédiée. Pas critique au démarrage.

**Bull-Board** : interface admin web pour les jobs, montée sur `/admin/jobs` derrière un guard "user a un flag admin". Optionnel.

## Tests

4 layers, du plus rapide au plus lent :

| Layer | Outil | Périmètre | Vitesse |
|---|---|---|---|
| Unit | Vitest | Fonctions pures : prompt composition, render HTML, validators, helpers | <100ms/test |
| Integration | Vitest + Postgres test | Repository functions, queries Drizzle, scoping multi-tenant, Better-Auth flows | 1-5s/test |
| Worker | Vitest + Redis test + APIs mocked | Jobs BullMQ : enqueue → wait completion → assert DB state | 2-10s/test |
| E2E | Playwright | Flows complets dans Chromium réel sur stack docker complète | 10-60s/test |

**Mocks d'APIs externes** : MSW (Mock Service Worker) avec fixtures pour Anthropic, Gemini, LinkedIn. Adapter `Storage` testable in-memory en unit/integration ; en E2E, vrai R2 ou MinIO testcontainer.

**Test d'isolation multi-tenant** : critique, dédié, obligatoire avant tout merge.

**CI GitHub Actions** : jobs `lint`, `unit`, `integration`, `worker`, `e2e` en parallèle, merge bloqué si un fail.

**TDD** : invoqué via `superpowers:test-driven-development` sur les chantiers à risque (auth, pipeline génération, tenant isolation, publication LinkedIn). Pragmatique sur le reste.

**Pas d'objectif coverage chiffré** : critère = chaque flow critique a au moins un E2E qui le valide, chaque repository function a un test integration qui valide le scoping + le happy path + un edge case.

**Optionnel — CI nightly** : run les E2E contre les vraies APIs (Anthropic, Gemini) avec budget capé, pour détecter les changements upstream.

## Roadmap de sous-projets

Découpage en 8 specs, chacune avec son propre cycle brainstorming → spec → plan → implementation.

1. **Bootstrap repo** : init Next.js + Biome + Drizzle + Better-Auth + BullMQ + Storage adapter + Vitest + Playwright. Docker Compose dev. CI. Premier E2E "signup → empty dashboard".
2. **Schema DB + admin** : schema Drizzle complet. Repository functions scoping `user_id`. Seed factory au signup. Page /settings/brand. Test multi-tenant isolation.
3. **Voice + writing_templates + visual_briefing** : pages CRUD. Portage des seeds v1.
4. **Pipeline texte (ideas → posts)** : pages /ideas et /posts. Job `generate-post`. Endpoint `/api/jobs/:id`. UI polling. Édition inline draft. Transition `draft → validated`.
5. **Media kind=image** : portage `src/visuals/` → `src/media/image/`. Schema `media` + `image_assets`. Job `generate-media`. Puppeteer worker. R2 + URLs signées. Page /media. Drawers template et standalone. Attachement post.
6. **Publications + LinkedIn** : schema `publications`. Worker `publish-post`. OAuth LinkedIn. Chiffrement tokens. Snapshots R2. Pages "historique des publications par post". Boutons "Publier" / "Planifier".
7. **API REST + MCP** : `api_tokens` table + page /settings/api-keys. API REST `/api/v1/...`. MCP server (`@modelcontextprotocol/sdk`) en Route Handler. Tools MCP : CRUD ideas (core), generate-post (extended). Auth bearer.
8. **Polish + observability + déploiement** : logs pino, Sentry, Bull-Board, rate-limiting, Dockerfile prod multi-stage, compose.prod.yml, guide Coolify, smoke test LinkedIn DRY_RUN.

**Optionnel — Spec 9 : migration data v1 → v2** : script tsx qui lit SQLite v1 et écrit dans Postgres v2 sous un user "default".

**Séquençage suggéré** :
- Sprints 1-2 : Specs 1 + 2 (foundation, rien à montrer côté produit)
- Sprint 3 : Specs 3 + 4 (premier flow démo : idée → post généré)
- Sprint 4 : Spec 5 (médias)
- Sprint 5 : Spec 6 (publications, premier post LinkedIn réel)
- Sprint 6 : Spec 7 (MCP, débloque l'usage Claude Desktop qui était le déclencheur initial)
- Sprint 7 : Spec 8 (mise en prod sereine)

**Parallélisations possibles** :
- Spec 5 dès que Spec 2 est mergé, en parallèle de 3/4
- Spec 7 dès que Spec 4 est mergé, en parallèle de Spec 6

## Critères de réussite (au terme du chantier complet)

- Un user peut signup, valider son email, accéder à son dashboard vide.
- Il configure sa voix, son visual_briefing, son brand, ses templates d'écriture.
- Il crée une idée avec brief, lance la génération, voit son post draft apparaître ~10s plus tard.
- Il génère un visuel via template, le voit attaché au post.
- Il valide, planifie une publication LinkedIn, voit la publication apparaître dans son historique au moment T.
- Il connecte Claude Desktop via le MCP, ajoute des idées depuis Claude, voit ses idées dans l'UI.
- Toutes les opérations IA passent par la queue, jamais d'attente HTTP > 1s côté `web`.
- Tests : `npm test` vert (unit + integration + worker + e2e), test isolation multi-tenant vert.
- Deux users ne se voient jamais (test sentinelle).
- Un user peut se déconnecter, supprimer son compte, ses données sont supprimées en cascade.
- `docker compose up` sur un nouveau VPS donne une instance fonctionnelle en moins de 10 minutes (hors temps d'obtenir les credentials R2 + Anthropic + Gemini + LinkedIn OAuth app).

## Hors-scope (v2)

- Organisations/teams/workspaces (user = tenant suffit au démarrage).
- Billing / plans payants.
- Carousels, vidéos (les schemas sont prêts à les accueillir, mais l'implémentation est différée).
- Plateformes autres que LinkedIn (X, Instagram, Threads — additif via le pattern `social_accounts.platform`).
- A/B testing, analytics de performance de post.
- Collaboration multi-user sur une même idée.
- Versioning du contenu (les `publications` jouent ce rôle pour le contenu publié, mais pas pour les drafts).
- Migration in-place sur l'infra v1 (clean slate sur nouveau repo, v1 reste comme référence et continue à tourner en parallèle si besoin).

## Décisions en suspens (à trancher dans les sous-specs)

- **Nom du nouveau repo** : `content-os-v2` vs réécriture de `content-os` après tag `v1`. À décider en Spec 1.
- **Plugin Better-Auth pour LinkedIn OAuth** vs flow custom porté de la v1. À décider en Spec 6.
- **Bull-Board** dans le compose dev ou pas. À décider en Spec 8.
- **Sentry** obligatoire ou opt-in. À décider en Spec 8.
- **Endpoint `/api/jobs/:id` accessible aussi via MCP** (l'agent peut poller son propre job) ou pas. À décider en Spec 7.
- **Server-Sent Events vs polling** pour les notifications de fin de job. À décider en Spec 4 (par défaut polling).
- **Schema-per-tenant** vs scoping `user_id` partagé : on part sur le scoping partagé (le plus simple), mais à reconsidérer si compliance/scale l'exige plus tard.
- **Handshake "needs_clarification" agent ↔ ContentOS** : quand un agent IA externe (MCP/API) pousse une idée trop floue ou demande à générer un post sans brief suffisant, ContentOS pourrait renvoyer une demande de clarification structurée (questions ciblées : angle, audience, exemples) plutôt qu'une simple erreur 400. L'agent re-soumet enrichi, ou propose à l'humain. À concevoir en Spec 7 (ou plus tôt si la friction se fait sentir). Spec 4 reste sur du fail-fast : brief vide = erreur, l'humain (ou l'agent appelant) sait qu'il doit fournir du contenu travaillé.
