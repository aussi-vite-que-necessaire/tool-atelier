# Spec 2 — Schema business + repositories scopés + page Brand

Date : 2026-05-22
Statut : design validé, à implémenter
Référence parent : [`2026-05-22-architecture-cible-v2-design.md`](./2026-05-22-architecture-cible-v2-design.md)
Référence amont : [`2026-05-22-spec-1-bootstrap-design.md`](./2026-05-22-spec-1-bootstrap-design.md)

## Contexte

Spec 1 a posé le squelette technique du repo `content-os-v2` (Next.js + Drizzle + Better-Auth + BullMQ + Storage + tests + CI), avec un seul flow utilisateur (signup magic link → dashboard vide → logout). Le schema DB se limite aux 4 tables Better-Auth (`user`, `session`, `account`, `verification`) et à `settings` (brand identity, singleton par user) avec son repository et sa sentinelle tenant minimale.

Spec 2 étend la fondation côté données : on crée les tables métier qui vont accueillir le pipeline éditorial (idée → post → publication, avec média attaché), on pose leurs repositories CRUD scopés `user_id`, et on ouvre la première vraie surface utilisateur (page `/settings/brand`) pour valider visuellement que l'auth + le scoping + un Server Action fonctionnent de bout en bout.

Rien de la machinerie métier (génération IA, queue jobs, OAuth LinkedIn, publication) ne tombe ici — c'est l'affaire des Specs 4 à 8. Spec 2 fournit uniquement les fondations DB sur lesquelles ces specs vont construire.

## Périmètre

**Crée :**
- 5 tables Postgres : `ideas`, `posts`, `publications`, `media`, `image_assets`, avec leurs enums (`post_status`, `publication_status`, `media_kind`, `image_source`).
- 5 fichiers de repositories TS dans `src/lib/db/repositories/`, chacun exposant 4-5 fonctions CRUD scopées `user_id`.
- Section UI `/settings/...` : layout avec sidebar, page `/settings/brand` (form 3 inputs + Server Action), redirect `/settings` → `/settings/brand`.
- Harness générique de tenant isolation (`test/integration/helpers/tenant-isolation-harness.ts`) + appels sur les 5 nouvelles tables, en plus du test bespoke settings déjà en place.
- Réorganisation de `src/lib/db/schema.ts` en barrel + fichiers `src/lib/db/schemas/{auth,settings,ideas,posts,publications,media}.ts`.

**Ne crée pas :**
- Tables `carousel_assets`, `video_assets`, `voice`, `visual_briefing`, `writing_templates`, `visual_styles`, `social_accounts`, `api_tokens`.
- Queries spécialisées (joins, filtres par status, list-due, etc.).
- Index `idx_posts_pub_due` (concerne Spec 6).
- Pages UI au-delà de `/settings/brand`.
- Server actions ou route handlers pour les nouvelles tables (juste les repositories).
- Helpers composites (ex: `createImageMedia` qui combine `createMedia` + `createImageAsset`).
- Modification de la seed factory au-delà de l'existant Spec 1 (signup → `upsertSettings`).

## Décisions

- **Format d'ID** : `text` PK + génération app-side via `createId()` de `@paralleldrive/cuid2`. Cohérent avec le typing `text` déjà en place pour les tables Better-Auth, et permet de retourner l'id immédiatement depuis la fonction `create*` sans `RETURNING`.
- **Schema complet upfront** : toutes les colonnes décrites dans le design parent sont créées dès Spec 2, même celles qui ne seront pas écrites avant les Specs 5-6 (cycle de vie publications, métadonnées IA image_assets). Coût : du SQL "mort" temporaire ; gain : les specs consommatrices n'ont qu'à ajouter de l'usage, zéro `ALTER TABLE ADD COLUMN` en cascade.
- **FK behavior** : `ON DELETE CASCADE` partout, sauf `posts.media_id` en `ON DELETE SET NULL` (supprimer un média ne doit pas effacer le post éditorial). Le critère de succès "delete user → toutes ses données disparaissent" du design parent est garanti par les CASCADE depuis `user`.
- **FK orphelines** : `posts.writing_template_id`, `image_assets.style_id`, `publications.social_account_id` sont créés en `text` nullable **sans contrainte FK** dans Spec 2. Les `ALTER TABLE ADD CONSTRAINT` sont à la charge des Specs 3 (writing_templates, visual_styles) et 6 (social_accounts) qui créent les tables référencées.
- **Repositories minimaux** : CRUD pur, pas de queries spécialisées. Chaque consommateur (Spec 4+) connaîtra mieux le shape exact dont il a besoin.
- **Validation** : zod uniquement dans les Server Actions / route handlers. Les repositories font confiance à leurs callers.
- **Sentinelle tenant** : harness générique paramétré par un fixture par repository. Coût initial ~80 lignes, amorti dès la 3e table.

## Schema Drizzle

### Organisation des fichiers

```
src/lib/db/
├── client.ts                # inchangé Spec 1
├── schema.ts                # barrel : re-export depuis schemas/*
└── schemas/
    ├── auth.ts              # user, session, account, verification
    ├── settings.ts          # settings
    ├── ideas.ts             # ideas
    ├── posts.ts             # posts + postStatus enum
    ├── publications.ts      # publications + publicationStatus enum
    └── media.ts             # media + image_assets + mediaKind + imageSource enums
```

Les imports externes existants (`from '@/lib/db/schema'`) continuent de fonctionner via le barrel. Aucun fichier consommateur n'a besoin d'être modifié pour la refacto.

### Tables

**`ideas`**
```ts
id              text PK,                          // cuid2
user_id         text NOT NULL FK → user CASCADE,
idea            text NOT NULL,
brief           text,                              // nullable, contexte additionnel
created_at      timestamp DEFAULT now() NOT NULL,
updated_at      timestamp DEFAULT now() NOT NULL,
INDEX ideas_user_id_idx (user_id)
```

**`posts`**
```ts
id                      text PK,
user_id                 text NOT NULL FK → user CASCADE,
idea_id                 text NOT NULL FK → ideas CASCADE,
writing_template_id     text,                     // nullable, FK ajoutée en Spec 3
media_id                text FK → media SET NULL, // nullable
content                 text NOT NULL,
status                  post_status NOT NULL DEFAULT 'draft',
created_at              timestamp DEFAULT now() NOT NULL,
updated_at              timestamp DEFAULT now() NOT NULL,
INDEX posts_user_id_idx (user_id)
INDEX posts_idea_id_idx (idea_id)
INDEX posts_media_id_idx (media_id)

ENUM post_status = ('draft', 'validated')
```

**`publications`**
```ts
id                      text PK,
user_id                 text NOT NULL FK → user CASCADE,
post_id                 text NOT NULL FK → posts CASCADE,
content_snapshot        text NOT NULL,
media_kind              media_kind,               // nullable si pas de média
snapshot_keys           text[],                   // nullable, 1..N R2 keys
social_account_id       text,                     // nullable, FK ajoutée en Spec 6
platform                text NOT NULL,
status                  publication_status NOT NULL DEFAULT 'scheduled',
scheduled_for           timestamp,
scheduled_tz            text,
published_at            timestamp,
external_post_id        text,
external_url            text,
attempts                integer NOT NULL DEFAULT 0,
last_attempt_at         timestamp,
next_attempt_at         timestamp,
failure_kind            text,
last_error              text,
created_at              timestamp DEFAULT now() NOT NULL,
updated_at              timestamp DEFAULT now() NOT NULL,
INDEX publications_user_id_idx (user_id)
INDEX publications_post_id_idx (post_id)

ENUM publication_status = ('scheduled', 'queued', 'publishing', 'published', 'failed')
```

**`media`**
```ts
id              text PK,
user_id         text NOT NULL FK → user CASCADE,
kind            media_kind NOT NULL,
asset_key       text NOT NULL,
preview_key     text NOT NULL,
width           integer NOT NULL,
height          integer NOT NULL,
created_at      timestamp DEFAULT now() NOT NULL,
updated_at      timestamp DEFAULT now() NOT NULL,
INDEX media_user_id_idx (user_id)

ENUM media_kind = ('image', 'carousel', 'video')  // 3 valeurs dès Spec 2
```

**`image_assets`** (table inheritance one-to-one via `media_id PK FK`)
```ts
media_id        text PK FK → media CASCADE,
source          image_source NOT NULL,
template_slug   text,                              // nullable, présent si source='template'
vars            jsonb,                             // nullable, présent si source='template'
ai_brief        text,                              // nullable
ai_source_key   text,                              // nullable
style_id        text,                              // nullable, FK ajoutée en Spec 3

ENUM image_source = ('template', 'standalone')
```

### Migration

Un seul fichier généré : `drizzle/0001_business_schema.sql` (nom auto-généré par `drizzle-kit generate`, à committer tel quel). Contient :
- Création des 4 enums (`post_status`, `publication_status`, `media_kind`, `image_source`).
- Création des 5 tables avec leurs colonnes, NOT NULL, defaults.
- Création des contraintes FK avec ON DELETE behaviors.
- Création des indexes.

Aucune modification de la migration `0000_*.sql` existante.

## Repositories

Tous dans `src/lib/db/repositories/`. Pattern uniforme, `userId` toujours premier paramètre.

### Shape commun

```ts
async function createX(userId: string, data: CreateXInput): Promise<X>
async function getX(userId: string, id: string): Promise<X | undefined>
async function listX(userId: string): Promise<X[]>
async function updateX(userId: string, id: string, patch: UpdateXPatch): Promise<X | undefined>
async function deleteX(userId: string, id: string): Promise<void>
```

### Invariants

- **SELECT/UPDATE/DELETE** : toujours `WHERE id = $id AND user_id = $userId` (jamais `WHERE id = $id` seul).
- **INSERT** : `user_id` posé depuis le paramètre de fonction, jamais accepté depuis `data`. `id` généré via `createId()` côté fonction, retourné dans la row.
- **UPDATE** : `updated_at: new Date()` réinjecté côté code (pas de trigger SQL).
- **Update/delete cross-tenant** : no-op silencieux (`update` retourne `undefined`, `delete` ne lève pas).

### Spécificités

- **`media`** : CRUD pur sur la table de base. Pas de helper composite `createImage` qui ferait media + image_assets en transaction — c'est Spec 5.
- **`image-assets`** : 4 fonctions au lieu de 5 (pas de `listImageAssets` — sidecar one-to-one, accédé par `media_id`). Signatures :
  ```ts
  createImageAsset(userId, data: { mediaId, source, templateSlug?, vars?, aiBrief?, aiSourceKey?, styleId? })
  getImageAsset(userId, mediaId)
  updateImageAsset(userId, mediaId, patch)
  deleteImageAsset(userId, mediaId)
  ```
  Le scoping se fait via join interne sur `media.user_id` (pas de colonne `user_id` redondante sur `image_assets`).
- **`publications.update`** : accepte un patch large couvrant tous les champs de cycle de vie (`status`, `scheduled_for`, `attempts`, `last_attempt_at`, `next_attempt_at`, `failure_kind`, `last_error`, `external_post_id`, `external_url`, `published_at`). Aucun appelant en Spec 2, mais Spec 6 utilisera ces patches sans avoir à modifier le repository.

### Types exportés

Chaque schéma exporte ses types via `$inferSelect` / `$inferInsert`. Les repositories importent ces types et les re-exportent depuis leur fichier pour les consommateurs.

## Section `/settings/...`

### Structure de routes

```
src/app/(app)/settings/
├── layout.tsx              # sidebar + <main>{children}</main>
├── page.tsx                # redirect → /settings/brand
└── brand/
    ├── page.tsx            # server component, lit settings, rend BrandForm
    └── actions.ts          # server action updateBrandSettings
```

### Sidebar settings

`src/components/settings/settings-sidebar.tsx` (client component pour `usePathname`).

Items dans l'ordre, classes Tailwind via shadcn/cn :
1. **Brand** (actif) — `<Link href="/settings/brand">` avec state actif via `pathname.startsWith('/settings/brand')`.
2. **Voix** (désactivé) — `<span aria-disabled="true">` text-muted-foreground + caption "à venir".
3. **Templates d'écriture** (désactivé).
4. **Visual briefing** (désactivé).
5. **Visual styles** (désactivé).
6. **Clés API** (désactivé).

### Page Brand

`brand/page.tsx` (server component) :
1. `auth.api.getSession({ headers: await headers() })` — redirect `/signin` si pas de session (le middleware s'en charge déjà, mais sécurité défensive en plus pour TypeScript narrowing).
2. `getSettings(session.user.id)` — si `undefined` (ne devrait pas arriver, hook signup garantit la row), passe `{ brandName: '', brandColor: '#000000', brandSignature: '' }` comme `initialValues` (mêmes defaults que la DB).
3. Rend `<BrandForm initialValues={{ brandName, brandColor, brandSignature }} />`.

`<BrandForm>` (client component) :
- `useActionState(updateBrandSettings, { status: 'idle' })` pour binding form ↔ action.
- 3 inputs shadcn :
  - `<Input name="brand_name" type="text" defaultValue={initialValues.brandName} maxLength={100} />`
  - `<Input name="brand_color" type="color" defaultValue={initialValues.brandColor} />`
  - `<Textarea name="brand_signature" defaultValue={initialValues.brandSignature} maxLength={1000} rows={3} />`
- Submit button avec `useFormStatus().pending` pour disable + label "Enregistrement…".
- `useEffect` qui déclenche `toast.success("Identité de marque mise à jour")` (sonner) si `state.status === 'success'`, ou `toast.error(...)` si `state.status === 'error'`.

### Server action

`brand/actions.ts` :

```ts
'use server'

type State =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }

export async function updateBrandSettings(
  prev: State,
  formData: FormData,
): Promise<State>
```

Étapes :
1. `auth.api.getSession({ headers: await headers() })` — retourne `{ status: 'error', message: 'unauthenticated' }` si pas de session.
2. Parse via schéma zod :
   ```ts
   const brandSchema = z.object({
     brandName: z.string().max(100),
     brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
     brandSignature: z.string().max(1000),
   })
   ```
3. Sur erreur Zod : retourne `{ status: 'error', message: 'validation', fieldErrors }`.
4. `updateSettings(session.user.id, parsed)`.
5. `revalidatePath('/settings/brand')`.
6. Retourne `{ status: 'success' }`.

## Sentinelle tenant + harness

### Harness

`test/integration/helpers/tenant-isolation-harness.ts` :

```ts
export interface TenantIsolationFixture<TRow> {
  seed: (userId: string) => Promise<TRow>
  rowId: (row: TRow) => string
  get?: (userId: string, id: string) => Promise<TRow | undefined>
  list?: (userId: string) => Promise<TRow[]>
  update?: (userId: string, id: string, patch: unknown) => Promise<TRow | undefined>
  delete?: (userId: string, id: string) => Promise<void>
  updatePatch: unknown
  reload: (userId: string, id: string) => Promise<TRow | undefined>
}

export function runTenantIsolationSuite<T>(
  name: string,
  fixture: TenantIsolationFixture<T>,
): void
```

Batterie générée (4 tests par appel, chacun avec 2 users frais via `createTestUser`) :

1. **List scoped** : `seed(A)`, `seed(B)`, vérifie `list(A).length === 1` et `list(B).length === 1`, et que les ids des rows listées correspondent aux ids seedés.
2. **Get cross-tenant** : `seed(A)`, vérifie `get(B, id_A) === undefined`.
3. **Update no-op cross-tenant** : `seed(A)`, vérifie `update(B, id_A, patch) === undefined`, puis `reload(A, id_A)` montre que la row existe et n'a pas reçu le patch (comparaison sur un champ clé du patch).
4. **Delete no-op cross-tenant** : `seed(A)`, `delete(B, id_A)`, vérifie `reload(A, id_A) !== undefined`.

Tests sautés (via `test.skip`) si l'op correspondante est absente du fixture.

### Helper createTestUser

`test/integration/helpers/seed.ts` :

```ts
export async function createTestUser(label: string): Promise<string>
```

Insère une row `user` avec `id = createId()` (cuid2) et `email = ${label}-${id}@test.local` (unique), retourne l'id.

### Fichier de tests

`test/integration/tenant-isolation.test.ts` (étend l'existant) :

```ts
import { runTenantIsolationSuite } from './helpers/tenant-isolation-harness'
import { createTestUser } from './helpers/seed'

// settings : bespoke (singleton par user, pas de create/delete/list)
describe('settings — tenant isolation', () => {
  // tests existants + 1-2 ajouts si pertinent
})

// 5 nouvelles tables via le harness
runTenantIsolationSuite('ideas', { /* fixture */ })
runTenantIsolationSuite('posts', { /* seed crée idea puis post */ })
runTenantIsolationSuite('publications', { /* seed crée idea + post puis publication */ })
runTenantIsolationSuite('media', { /* fixture */ })
runTenantIsolationSuite('image_assets', { /* seed crée media puis image_assets */ })
```

### TDD invocation

Invoquer `superpowers:test-driven-development` pour :
- Le harness lui-même, écrit RED → GREEN → REFACTOR avec le fixture `ideas` comme premier cas.
- Une fois le pattern verrouillé, les 4 autres fixtures s'écrivent directement sans relancer TDD.

Pour les repositories : TDD léger en parallèle de l'implémentation (tests integration happy path par CRUD function).

Pour le Server Action Brand : TDD strict (zod validation, cas unauthenticated, cas success).

Pour le reste (sidebar, layout, page UI) : pragmatique, l'E2E couvre.

## Tests

| Layer | Périmètre Spec 2 |
|---|---|
| Lint | `biome check .` zéro warning sur tous les nouveaux fichiers. |
| Unit | Validateur Zod du Server Action Brand (cas valides + un cas d'erreur par champ). |
| Integration | 5 fichiers `test/integration/{ideas,posts,publications,media,image-assets}-repository.test.ts` (happy path CRUD par table). Fichier existant `test/integration/tenant-isolation.test.ts` étendu (settings bespoke + 5 appels harness). 1 nouveau fichier `test/integration/settings-action.test.ts` (Server Action `updateBrandSettings` : success, validation error, unauthenticated). |
| Worker | Aucun ajout. |
| E2E | 1 nouveau `settings-brand.spec.ts` : signup → /settings/brand → fill form → submit → reload → valeurs persistées + color picker affiche la bonne couleur. L'E2E auth existant continue de passer. |

## Dépendances

Une seule nouvelle dépendance npm :

- `@paralleldrive/cuid2` — génération d'IDs côté app pour les nouveaux repositories.

`zod`, `drizzle-orm`, `sonner`, `next/headers`, `next/cache` (pour `revalidatePath`) sont déjà installés ou natifs Next.js. Pas de `react-hook-form` (on utilise `useActionState` + `useFormStatus` natifs).

## Critères de done

À vérifier avant merge :

1. `npm run lint` vert.
2. `npm test` vert (unit + integration + worker).
3. `npm run build && npm run test:e2e` vert.
4. CI GitHub Actions verte sur les 5 jobs.
5. `npm run db:generate` n'a pas de diff non-commité après le merge (la migration `0001_business_schema.sql` reflète exactement le schema TS et est commitée).
6. Sentinelle tenant teste les 5 nouvelles tables + settings, et passe.
7. Smoke test manuel : signup → `/settings/brand` → modifier les 3 champs → recharger la page → valeurs persistées et color picker affiche la bonne couleur.

## Hors-scope (rappel explicite)

- Tables `carousel_assets`, `video_assets` (Specs 5+, kinds non implémentés).
- Tables `voice`, `visual_briefing`, `writing_templates`, `visual_styles` (Spec 3).
- Tables `social_accounts` (Spec 6), `api_tokens` (Spec 7).
- Pages `/ideas`, `/posts`, `/media`, `/publications` (Specs 4, 5, 6).
- Queries spécialisées (`getPostWithMedia`, `listPublicationsDueAt`, `listPostsByStatus`, etc.) — chaque spec consommatrice les ajoute selon son besoin.
- Index `idx_posts_pub_due` (partiel sur `publications WHERE status IN ('scheduled', 'queued')`) — Spec 6, quand le worker `publish-post` arrive.
- Server actions ou route handlers métier au-delà du form Brand (POST /api/ideas etc.) — Specs 4+.
- Helpers composites (`createImageMedia` = `createMedia` + `createImageAsset` en transaction) — Spec 5.
- Seed factory au-delà de `upsertSettings` (déjà en place Spec 1) — pas de seed `voice`, `visual_briefing`, `writing_templates` en Spec 2.
- Preview live de la marque sur la sidebar, indicateur "non-sauvegardé", reset/cancel button sur le form Brand, upload d'image de logo.
- Migration data v1 → v2 (Spec 9 optionnelle).

## Décisions en suspens

Aucune. Toutes les décisions structurantes ont été tranchées pendant le brainstorming (cf. journal des questions 1-7).
