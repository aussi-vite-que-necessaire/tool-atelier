# Spec — Comptes opérateur/audience + ressources multi-tenant

**Date.** 2026-05-29
**Projets touchés.** `auth` (accountType central) + `ressources` (multi-tenant)
**ADR lié.** [ADR-0002](../../../../docs/decisions/0002-comptes-operateur-audience-tenancy.md)

## But

Transformer `ressources` d'un outil single-tenant (un seul admin = le propriétaire de
l'atelier, désigné par la variable d'env `ADMIN_USER_IDS`) en plateforme multi-tenant où
**chaque opérateur** (client SaaS de niveau 1) possède son espace de ressources, partageable
via un lien à lui, et où **les membres d'audience** qui s'inscrivent pour lire ses ressources
lui sont rattachés.

La distinction opérateur/audience devient une propriété **centrale** de l'identité
(`accountType` dans `auth.contentos.ch`), héritée par tous les outils de la suite ; la
**tenancy** (qui possède quoi, qui appartient à qui) reste **locale** à `ressources`.

Non-objectifs v1 : super-admin / visibilité cross-tenant, onboarding self-serve d'opérateur,
thème par opérateur, types de consommateur autres que `audience`, double rôle
opérateur+audience pour un même user.

## Modèle de données

### auth (central)

- `user.accountType` : `text not null default 'audience'`, valeurs `'operator' | 'audience'`.
  Ajouté côté BetterAuth via `user.additionalFields` avec **`input: false`** (non
  positionnable par le client à l'inscription/update) ; exposé par `get-session`.
- Octroi du rôle `operator` : opération manuelle/seed (mise à jour DB). Pas d'UI v1.
- Migration auth : marquer `operator` le user qui était l'admin de `ressources`.

### ressources (local, tenancy)

- `operators` : `id text primary key` (= `user.id` auth), `handle text not null unique`
  (slug d'espace public, `[a-z0-9-]`), `name text not null`, `created_at`. Profil opérateur
  **propre à l'outil** (le handle ressources peut différer d'un éventuel handle media/cast).
- `resources` : ajout `operator_id text not null references operators(id)`. **Unicité du slug
  passe de globale à `(operator_id, slug)`** (drop `resources_slug_unique`, ajout
  `resources_operator_slug`).
- `audience_members` : `id uuid`, `operator_id text references operators(id)`, `user_id text`
  (id auth), `source/medium/campaign text` (1ʳᵉ provenance), `created_at`,
  `unique(operator_id, user_id)`. Lie un membre d'audience à *son* opérateur.

`subscriptions`, `resource_access`, `view_events` restent inchangés dans leur forme (toujours
rattachés à une `resource`, donc indirectement à un opérateur via `resources.operator_id`).

### Migration des données existantes

One-shot dans `scripts/migrate.mjs` (ou migration SQL dédiée + seed) :
1. lire l'unique id admin existant (dernière lecture de `ADMIN_USER_IDS`, fournie au migrate) ;
2. créer la ligne `operators` correspondante (`handle` dérivé du nom, fallback id court) ;
3. `update resources set operator_id = <id>` pour toutes les ressources orphelines ;
4. peupler `audience_members` à partir des `subscriptions` existantes (distinct user_id).

## Surfaces & routage (même domaine, pas de sous-domaine)

- **Espace opérateur public** : `/o/<handle>` liste les ressources publiées de l'opérateur ;
  reader à `/o/<handle>/r/<slug>` (et `/o/<handle>/r/<slug>/<...path>`). C'est le **lien de
  partage** de l'opérateur.
- **Legacy** : `/r/<slug>` → 301 vers `/o/<handle>/r/<slug>` (résolution via l'ancien slug
  globalement unique tant que la migration n'a qu'un opérateur). Compat douce.
- **Racine `/`** : devient un landing plateforme minimal (plus de listing global de ressources,
  qui fuiterait tous les opérateurs).
- **Admin `/admin/*`** : scopé à l'opérateur courant. Dashboard, liste ressources, stats,
  édition : tout filtré par `operator_id`. Nouvel écran « Mon audience » (membres rattachés).
- **`/bibliotheque`, `/compte`** : espace lecteur (audience) inchangé sur le fond ; les liens
  vers les ressources passent par `/o/<handle>/r/<slug>`.

## Autorisation

- `lib/auth/session.ts` : `Session.user` gagne `accountType`. `fetchSession` lit
  `data.user.accountType` (preview → `'operator'` par défaut pour garder l'auto-login admin).
- Remplacer `lib/auth/admin.ts` (`userIsAdmin`/`requireAdmin` + `ADMIN_USER_IDS`) par
  `lib/auth/operator.ts` : `requireOperator()` → vérifie `accountType === 'operator'`,
  garantit/charge le profil `operators`, renvoie `{ id, handle, name }`. Sinon redirect `/`.
- Suppression de `ADMIN_USER_IDS` de `lib/env.ts` et du `lab.json`/secrets (doc).
- **Autorisation à la couche données** : `service`, `stats`, `mcp` prennent l'`operatorId`
  courant et scopent toutes les requêtes ; une ressource d'un autre opérateur → 404.
- **MCP** (`lib/mcp-auth.ts` + `app/api/[transport]`) : le user du token doit être `operator` ;
  les outils n'opèrent que sur ses ressources. Preview court-circuite en operator.
- **Audience** : à la première lecture d'une ressource d'un opérateur (ou visite de `/o/<handle>`
  authentifiée), upsert `audience_members(operator_id, user_id)` (avec provenance du cookie ref).
  `accountType='audience'` est déjà le défaut → rien à forcer.

## Gestion d'erreur

- Accès `/admin/*` par un non-opérateur connecté → redirect `/`. Non connecté → SSO
  (middleware inchangé : présence de session ; le check de rôle est au niveau page/service).
- Handle d'opérateur inconnu → 404. Ressource hors scope opérateur → 404.
- Migration idempotente (ré-exécutable sans dupliquer).

## Tests

- **Scoping service** : `listResources/getResource/create/update` ne renvoient/n'affectent que
  les ressources de l'`operatorId` donné ; accès cross-opérateur → null/404.
- **Slug** : unicité par opérateur (même slug autorisé chez deux opérateurs).
- **Audience** : lecture d'une ressource de l'opérateur X par un user → membership X créé ;
  un opérateur ne voit que son audience.
- **Autorisation** : `requireOperator` rejette `audience`, accepte `operator` ; MCP rejette un
  token non-operator.
- **Migration** : données existantes (ressources, abonnés) rattachées à l'opérateur seedé.
- Conserver/adapter les tests existants (`lib/access.test.ts`, `lib/account.test.ts`,
  `lib/resources/plan.test.ts`).

## Décisions tranchées sans re-demander

- URL espace opérateur : `/o/<handle>` (préfixe `o`), reader `/o/<handle>/r/<slug>`.
- `accountType` unique par user (operator **ou** audience) en v1.
- Provisioning opérateur manuel (pas d'UI). Handle initial dérivé du nom à la migration.
- Preview garde l'auto-login en `operator` (équivalent de l'ancien admin auto en preview).
