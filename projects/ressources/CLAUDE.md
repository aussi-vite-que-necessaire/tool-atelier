# ressources

**Outil d'administration** des ressources de la suite **contentos**
(`https://ressources.contentos.ch`). Côté **opérateur** (client SaaS) : il édite ici son espace
de ressources (arborescence de pages faites de modules typés), suit son **audience** et ses
stats, et le pilote par agent — ses tools sont fédérés par la **passerelle MCP centrale**
(`mcp.contentos.ch`) via l'endpoint interne `/internal/tools`. `ressources` est aussi le
**propriétaire du schéma** (tables + migrations) de la plateforme.

La **lecture publique** (landing, espaces `/o/<handle>`, reader SSR, bibliothèque/compte
lecteur) vit dans le projet voisin **`docs`** (`docs.contentos.ch`), qui partage **la même
base**. Découpage : `ressources` = admin (login **opérateur**) ; `docs` = public (login
**lecteur/audience**). Voir l'ADR-0002
(`../../docs/decisions/0002-comptes-operateur-audience-tenancy.md`) et le `CLAUDE.md` de `docs`.

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `postgres`,
postgres-js) + **Tailwind 4** (style brutaliste éditorial dans `app/globals.css`). Schéma dans
`db/schema/`, client paresseux dans `db/index.ts` (lit `DATABASE_URL` au runtime). Migrations
SQL committées dans `drizzle/`.

```
ressources/
├── Dockerfile        multi-stage : deps → build → runner (standalone, non-root, :8080) ; one-shot migrate + seed
├── compose.yml       service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json          description + db:true + migrate + seed
├── middleware.ts     SSO gate sur /admin (et l'entrée /connexion)
├── next.config.ts    output:"standalone"
├── drizzle/          migrations SQL committées (appliquées au déploiement)
├── scripts/migrate.mjs  applique drizzle/ à la base (migrator drizzle-orm/postgres-js)
├── scripts/backfill-operators.mjs  cutover prod single-tenant → multi-tenant (one-shot)
├── app/              App Router : /admin/*, /internal/tools (contrat de la passerelle MCP),
│                     /connexion, / (→ /admin), healthz/route.ts (GET /healthz : 200 "ok", sans DB)
├── db/ lib/ components/  schéma, accès données, helpers auth/operator, UI admin
```

## Schéma partagé avec `docs`

`ressources` est **seul propriétaire** du schéma et des migrations. `docs` lit la même base et
embarque une **copie générée** de `db/schema` + `db/index.ts`, synchronisée par
**`../../scripts/sync-shared.sh`** et vérifiée en CI (job `shared_guard`, `git diff --exit-code`).
**Faire évoluer le schéma** : éditer `db/schema/`, `npm run db:generate`, committer, puis
`scripts/sync-shared.sh` (sinon le build casse). Le prochain déploiement applique la migration.

## Authentification — SSO contentos

Auth déléguée à `https://auth.contentos.ch` (cookie cross-subdomain `.contentos.ch`).
Les helpers vivent sous `lib/auth/` :

- `lib/auth/session.ts` : `getSession()`, `requireSession(target?)`, `getUserId()`,
  `requireUserId(target?)`, `signInUrl(target?)`. Fetch `${AUTH_URL}/api/auth/get-session`
  avec le cookie forwardé ; en preview, court-circuite avec `PREVIEW_USER_ID`.
  Le user porte un `accountType` (`operator | audience`, central — ADR-0002).
- `lib/auth/operator.ts` : `requireOperator()`, `getOperator()`, `getOperatorById(id)`,
  `operatorByHandle(handle)`. **La porte « opérateur » de ressources = présence d'une ligne
  `operators`** pour ce user (tenancy locale ; marche aussi pour le MCP qui ne porte que
  `userId`). Provisionnée en tandem avec `accountType='operator'` côté auth.
- `lib/auth/preview.ts` : `PREVIEW_USER_ID`, `isPreview` (selon `APP_ENV`). En preview, la
  session est court-circuitée en `operator` (l'opérateur démo `/o/demo`, seedé — visible sur `docs`).
- `lib/mcp-internal.ts` : contrat interne consommé par la passerelle MCP — `listToolsResponse()`
  (schémas JSON) et `callToolByName(name, userId, args)`, qui **résout l'opérateur** depuis le
  `userId` (`getOperatorById`) et le dépose dans `authInfo.extra` (chaque outil n'opère que sur
  ses ressources ; compte non-opérateur → résultat isError). Gardé par `lib/mcp-internal-auth.ts`
  (`MCP_INTERNAL_KEY` partagée, court-circuitée en preview). Exposé sur `app/internal/tools/`.
- `app/connexion/page.tsx` : redirige vers `${AUTH_URL}/sign-in?redirect=...` (no-op en preview).

Modèle multi-tenant (ADR-0002) : un **opérateur** (table `operators`, `id` = user.id auth,
`handle` = slug d'espace) possède ses ressources (`resources.operator_id`, slug unique par
opérateur) et les édite via `/admin`. Les lecteurs (sur `docs`) qui accèdent à un espace
deviennent son **audience** (`audience_members`) et peuvent s'abonner (`subscriptions`). Toute
requête est scopée `operator_id`. `user_id`/operator `id` sont du text sans FK locale.

## Skill agentique

Le skill `creer-une-ressource` (cerveau qui pilote `ressources` via MCP) vit dans le hub
central de l'atelier : `skills/skills/creer-une-ressource/`. Téléchargeable sur
`https://skills.contentos.ch` après connexion OTP.

## Déployer

`git push` sur une branche → preview `https://ressources-<branche>.preview.contentos.ch`.
Merge de la PR → prod `https://ressources.contentos.ch`. Jamais de commit direct sur `main`.
La CI build l'image (`docker build`) → GHCR → pull sur `lab` ; le serveur ne build jamais.

## Données & secrets

`lab.json` déclare `"db": true` → la plateforme crée la base `<projet>_<env>` (Postgres
central) et injecte **`DATABASE_URL`** automatiquement. Le one-shot **`migrate`** applique
`drizzle/` avant le démarrage ; **`seed`** (hors prod) peuple l'opérateur démo `/o/demo`
(`node --import tsx db/seed.ts` ; idempotent). C'est cette base que `docs` lit en preview.

`APP_URL` est auto-injecté par la plateforme (= origine publique du déploiement).

Les secrets viennent du coffre `ressources` de l'atelier (`/lab-secret`, scope `ressources`),
déchiffrés et injectés par `deploy.sh` :

- `AUTH_URL` — facultatif, défaut `https://auth.contentos.ch`.
- `MCP_INTERNAL_KEY` — clé interne partagée (scope **global**) gardant `/internal/tools` (passerelle MCP) ; court-circuitée en preview.

Plus de `ADMIN_USER_IDS` : être opérateur = avoir une ligne `operators` (provisionnée en
tandem avec `accountType='operator'` côté auth). Pour octroyer le rôle à un user :
`UPDATE "user" SET account_type='operator'` (base auth) **et** créer son profil `operators`
(id, handle, name) dans ressources.

**Migration prod (cutover single-tenant → multi-tenant).** La preview part d'une base vide
seedée (opérateur démo) → rien à faire. Sur prod, le `ADD COLUMN operator_id NOT NULL` de la
migration 0004 suppose une table vide : jouer le backfill en trois temps — (1) créer
`operators` + colonne `operator_id` *nullable*, (2) `scripts/backfill-operators.mjs`
(`SEED_OPERATOR_USER_ID` = ancien admin, `SEED_OPERATOR_HANDLE`, `SEED_OPERATOR_NAME`), (3)
poser la contrainte `NOT NULL`.

## Vérifier (preview / dev)

`PREVIEW_USER_ID = 'preview-user'`, **opérateur démo**. En prod, l'accès à `/admin` redirige
vers `${AUTH_URL}/sign-in?redirect=...` ; le SSO renvoie ici avec le cookie cross-subdomain.
Admin scopé sous `app/admin/*` (dont `app/admin/audience/`) ; endpoint interne des tools sous
`app/internal/tools/`. **Le rendu public** (espaces, reader, `/o/<handle>`) se vérifie
sur `docs` (`docs.contentos.ch` / `docs-<branche>.preview.contentos.ch`), qui lit cette base.
