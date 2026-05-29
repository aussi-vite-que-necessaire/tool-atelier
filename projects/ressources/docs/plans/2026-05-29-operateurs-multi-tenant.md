# Comptes opérateur/audience + ressources multi-tenant — Plan d'implémentation

> **Exécution :** invoque `/lab-implémenter` pour exécuter ce plan tâche par tâche. Les steps utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** `ressources` devient multi-tenant. `auth` porte un `accountType` central (`operator|audience`). Chaque opérateur possède ses ressources, a un espace public partageable `/o/<handle>`, et voit l'audience qui s'y rattache. Fin de `ADMIN_USER_IDS`.

**Architecture:** `accountType` central dans auth (BetterAuth `additionalFields`, `input:false`). Tenancy locale à ressources : table `operators` (profil + handle), `resources.operator_id`, `audience_members`. La porte « opérateur » de ressources s'appuie sur la **présence d'une ligne `operators`** (proxy local, marche aussi pour le MCP qui ne porte que `userId`). Autorisation à la couche données : tout passe par `operatorId`.

**Tech Stack:** Next.js 16 App Router, Drizzle (postgres-js), Tailwind 4, BetterAuth, Vitest (tests purs, sans DB).

Spec de référence : `docs/specs/2026-05-29-operateurs-multi-tenant-design.md` · ADR : `docs/decisions/0002-comptes-operateur-audience-tenancy.md`.

**Vérification (pas de DB locale) :** chaque lot finit par `npm run typecheck`, `npm run lint`, `npm test` (tests purs), et `npm run build` quand des routes changent. La justesse du scoping data-layer est validée sur la **preview** (DB seedée). Tests unitaires ciblés sur la logique pure extractible (handle slugify, décision d'autorisation, mapping d'URL).

**Décidé sans demander (résiduel) :** backfill prod des données existantes = script dédié `scripts/backfill-operators.mjs` (idempotent, lancé une fois au cutover) plutôt qu'entremêlé au `drizzle migrate` (le problème œuf-poule du `operator_id NOT NULL` sur table peuplée). La preview part d'une DB vide seedée → pas concernée.

---

## Lot A — auth : `accountType` central

### Tâche A1 — colonne `accountType` sur `user`
- [ ] `projects/auth/src/db/schemas/auth.ts` : ajouter à `user` la colonne
  `accountType: text("account_type").notNull().default("audience")`.
- [ ] `cd projects/auth && npm run db:generate` (ou écrire à la main `drizzle/NNNN_*.sql` : `ALTER TABLE "user" ADD COLUMN "account_type" text NOT NULL DEFAULT 'audience';`). Vérifier le SQL généré.
- [ ] `npm run typecheck`.

### Tâche A2 — exposer `accountType` via BetterAuth
- [ ] `projects/auth/src/lib/auth.ts` : ajouter dans `betterAuth({...})` la clé
  `user: { additionalFields: { accountType: { type: "string", required: false, defaultValue: "audience", input: false } } }`.
  `input:false` ⇒ non positionnable côté client (frontière de confiance). `get-session` renvoie alors `user.accountType`.
- [ ] `npm run typecheck` + `npm run build`.

---

## Lot B — ressources : schéma + accès tenancy

### Tâche B1 — schéma `operators`
- [ ] Nouveau `projects/ressources/db/schema/operators.ts` :
  ```ts
  import { pgTable, text, timestamp } from "drizzle-orm/pg-core"
  export const operators = pgTable("operators", {
    id: text("id").primaryKey(), // = user.id auth
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  })
  export type OperatorRow = typeof operators.$inferSelect
  ```
- [ ] `db/schema/index.ts` : `export * from "./operators"`.

### Tâche B2 — `resources.operator_id` + unicité par opérateur
- [ ] `db/schema/content.ts` : import `operators` ; sur `resources` remplacer `slug: text("slug").notNull().unique()` par `slug: text("slug").notNull()` et ajouter `operatorId: text("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" })` ; ajouter contrainte table `unique("resources_operator_slug").on(t.operatorId, t.slug)`.

### Tâche B3 — `audience_members`
- [ ] `db/schema/access.ts` : ajouter
  ```ts
  export const audienceMembers = pgTable("audience_members", {
    id: uuid("id").defaultRandom().primaryKey(),
    operatorId: text("operator_id").notNull().references(() => operators.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    source: text("source"), medium: text("medium"), campaign: text("campaign"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [unique("audience_operator_user").on(t.operatorId, t.userId)])
  ```

### Tâche B4 — migration drizzle
- [ ] `cd projects/ressources && npm run db:generate`. Inspecter le SQL : doit créer `operators`, `audience_members`, ajouter `resources.operator_id`, basculer l'unicité du slug. Commit.

### Tâche B5 — seed preview & backfill prod
- [ ] `db/seed.ts` : créer d'abord l'opérateur preview `{ id: PREVIEW_USER_ID, handle: "demo", name: "Démo" }` (import depuis `@/lib/auth/preview`), puis passer `operatorId: <preview id>` à `createResource`. Les ressources seedées appartiennent à l'opérateur demo.
- [ ] Nouveau `scripts/backfill-operators.mjs` (idempotent) : lit `SEED_OPERATOR_USER_ID`, `SEED_OPERATOR_HANDLE`, `SEED_OPERATOR_NAME` ; upsert `operators` ; `UPDATE resources SET operator_id = ... WHERE operator_id IS NULL` ; INSERT distinct `(operator_id, user_id)` dans `audience_members` depuis `subscriptions`. Documenté dans le CLAUDE.md (cutover prod).

---

## Lot C — ressources : session + porte opérateur

### Tâche C1 — `accountType` dans la session
- [ ] `lib/auth/session.ts` : `Session.user` gagne `accountType: "operator" | "audience"`. `fetchSession` lit `data.user.accountType` (défaut `"audience"`). En preview, renvoyer `accountType: "operator"`.

### Tâche C2 — `lib/auth/operator.ts`
- [ ] Nouveau module :
  ```ts
  import { redirect } from "next/navigation"
  import { db } from "@/db"; import { operators } from "@/db/schema"; import { eq } from "drizzle-orm"
  import { getSession, signInUrl } from "./session"
  export type Operator = { id: string; handle: string; name: string }
  export async function getOperator(): Promise<Operator | null> {
    const s = await getSession(); if (!s) return null
    const [op] = await db.select().from(operators).where(eq(operators.id, s.user.id)).limit(1)
    return op ? { id: op.id, handle: op.handle, name: op.name } : null
  }
  export async function requireOperator(): Promise<Operator> {
    const s = await getSession(); if (!s) redirect(signInUrl())
    const op = await getOperator(); if (!op) redirect("/")
    return op
  }
  export async function operatorByHandle(handle: string): Promise<Operator | null> { /* select by handle */ }
  ```
- [ ] Test pur `lib/auth/operator.test.ts` sur une éventuelle fonction pure d'autorisation extraite (sinon couvert par typecheck/build).

### Tâche C3 — retrait de `admin.ts` / `ADMIN_USER_IDS`
- [ ] Supprimer `lib/auth/admin.ts`. `lib/env.ts` : retirer `ADMIN_USER_IDS` + `adminUserIds()`. Remplacer tous les `requireAdmin()` par `requireOperator()` (voir lots E, MCP). `grep -rn "requireAdmin\|userIsAdmin\|ADMIN_USER_IDS\|adminUserIds" projects/ressources` → 0.
- [ ] `.env.example`, `lab.json` (doc secrets), CLAUDE.md : retirer `ADMIN_USER_IDS`.

### Tâche C4 — MCP gate opérateur
- [ ] `app/api/[transport]/route.ts` : après `verifyMcpToken`, charger l'opérateur via `userId` (`operatorByHandle`-équivalent par id) ; si absent → erreur auth. Passer `operatorId` aux outils.
- [ ] `lib/mcp-auth.ts` : preview inchangé (court-circuit operator).

---

## Lot D — ressources : scoping de la couche données

### Tâche D1 — `service.ts` scopé par `operatorId`
- [ ] Toutes les fonctions prennent `operatorId` en 1ᵉʳ argument et l'injectent dans les `where` :
  - `getResourceRowBySlug(operatorId, slug)` → `and(eq(resources.operatorId, operatorId), eq(resources.slug, slug))`.
  - `resolve`, `listResources(operatorId)`, `createResource(operatorId, input)` (slug unique calculé parmi les slugs **de cet opérateur**, `operatorId` inséré), `updateResource`, `deleteResource`, `getResource`, `getOutline`, `trackingLink`, `addPage`/`addModules`/`updatePage`/… (via `resolve` scopé), `grantAccess`/`revokeAccess`/`listAccess`.
  - `resourceUrl(handle, slug)` → `/o/<handle>/r/<slug>` ; `pagePath(handle, slug, path)` idem. Les fonctions qui construisent des URLs reçoivent le `handle` de l'opérateur.
- [ ] `npm run typecheck` (le compilateur révèle tous les appelants à mettre à jour).

### Tâche D2 — `content/queries.ts` (reader + lecteur)
- [ ] `getResourceBySlug(operatorId, slug, includeUnpublished?)` scopé. `listOperatorResources(operatorId)` (remplace l'usage de `listFeaturedResources` pour l'espace `/o/<handle>`). `listSubscriptions(userId)` : joindre `operators` pour renvoyer aussi `handle` (les liens lecteur deviennent `/o/<handle>/r/<slug>`).
- [ ] `audience` : `upsertAudienceMember(operatorId, userId, ref?)` (onConflictDoNothing) ; `listAudience(operatorId)`.

### Tâche D3 — `stats/queries.ts` scopé
- [ ] `getStatsOverview(operatorId)` et `getResourceStats(operatorId, slug, …)` : restreindre aux ressources de l'opérateur (join/filtre `resources.operator_id`).

---

## Lot E — ressources : actions + UI admin

### Tâche E1 — `lib/actions/admin.ts`
- [ ] Remplacer chaque `await requireAdmin()` par `const op = await requireOperator()` et passer `op.id`/`op.handle` au service. Les `redirect`/`revalidatePath` vers `/admin/r/<slug>` inchangés (admin reste sous `/admin`).

### Tâche E2 — pages admin scopées + « Mon audience »
- [ ] `app/admin/page.tsx` : `requireOperator`, `listResources(op.id)`, `getStatsOverview(op.id)`. Lien « Site ↗ » → `/o/${op.handle}`.
- [ ] `app/admin/r/[slug]/...` : `requireOperator`, service scopé `op.id` ; ressource hors scope → `notFound()`.
- [ ] `app/admin/layout.tsx` : `requireOperator` ; nav ajoute « Audience » → `/admin/audience`.
- [ ] Nouveau `app/admin/audience/page.tsx` : `listAudience(op.id)`, table simple (email/nom si dispo, date).

### Tâche E3 — liens ressources côté lecteur
- [ ] `components/resource-card.tsx` : prop `handle` ; lien `/o/${handle}/r/${slug}`.
- [ ] `app/bibliotheque/page.tsx`, `app/compte/page.tsx` : utiliser `handle` renvoyé par `listSubscriptions`.

---

## Lot F — ressources : routage public

### Tâche F1 — espace opérateur + reader sous `/o/[handle]`
- [ ] Déplacer `app/(public)/r/[slug]/` → `app/(public)/o/[handle]/r/[slug]/` (page, render, `[...path]`). Résoudre l'opérateur par `handle` (`operatorByHandle`) → 404 si inconnu ; charger la ressource scopée `op.id` + slug.
- [ ] Nouveau `app/(public)/o/[handle]/page.tsx` : landing de l'espace opérateur = liste de ses ressources publiées (`listOperatorResources`), réutilise `ResourceCard`/`SiteHeader`/`SiteFooter`.

### Tâche F2 — redirect legacy `/r/[slug]`
- [ ] `app/(public)/r/[slug]/[[...path]]/page.tsx` minimal : résoudre l'ancien slug (globalement unique avant migration) → `redirect("/o/<handle>/r/<slug>/…", 301)` ; introuvable → 404.

### Tâche F3 — racine `/`
- [ ] `app/page.tsx` : landing plateforme sobre (hero + explication), sans listing global. Garde `SiteHeader`/`SiteFooter`.

### Tâche F4 — middleware
- [ ] `middleware.ts` : matcher tracking `/o/:path*` (au lieu de `/r/:path*`) ; `setRefCookie` sur `/o/`. SSO_GATED inchangé (`/admin|compte|bibliotheque`). Conserver `/r/:path*` dans le matcher pour le redirect legacy (sans tracking).

---

## Lot G — flux audience

### Tâche G1 — rattachement à la lecture
- [ ] Dans le reader `/o/[handle]/r/[slug]` (ou `ResourceGate`/action d'accès), quand une session existe et accède à une ressource de l'opérateur : `upsertAudienceMember(op.id, userId, refFromCookie)`. Réutiliser la provenance déjà lue pour `addSubscription`.
- [ ] Vérifier que l'abonnement (`addSubscription`) et le membership audience sont posés de façon cohérente (même point d'entrée).

---

## Lot H — MCP descriptions + docs + clôture

### Tâche H1 — descriptions MCP
- [ ] `lib/resources/mcp.ts` : mettre à jour les descriptions qui citent `/r/slug/...` en `/o/<handle>/r/slug/...` ; passer `operatorId` (depuis le contexte route) aux appels `service.*`/`stats.*`.

### Tâche H2 — docs projet
- [ ] `projects/ressources/CLAUDE.md` : section auth → opérateur/audience, routes `/o/<handle>`, suppression `ADMIN_USER_IDS`, mention backfill. `lab.json` description si besoin.

### Tâche H3 — clôture
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` (ressources) ; `npm run typecheck && npm run build` (auth). Tout vert.
- [ ] Vérif finale : `grep -rn "requireAdmin\|ADMIN_USER_IDS\|/r/\${" projects/ressources/app projects/ressources/lib` → seulement le redirect legacy attendu.

---

## Couverture spec (self-check)

- accountType central + input:false → A1/A2 ✓ · operators/operator_id/audience_members → B ✓ · requireOperator + suppression ADMIN_USER_IDS → C ✓ · scoping data-layer (service/queries/stats/mcp) → D, C4, H1 ✓ · `/o/<handle>` + reader + legacy redirect + landing `/` → F ✓ · admin scopé + Mon audience → E ✓ · rattachement audience → G ✓ · migration/seed/backfill → B4/B5 ✓ · docs → H2 ✓.
