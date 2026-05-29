# ressources

Plateforme de lead magnets de la suite **contentos** (`https://ressources.contentos.ch`),
**multi-tenant** : chaque **opérateur** (client SaaS) possède son espace de ressources,
partageable via `/o/<handle>`, et son **audience** (les lecteurs qui s'y rattachent). Une
ressource = une arborescence de pages faites de modules typés, servie sur
`/o/<handle>/r/<slug>` par un reader SSR. Authentification déléguée au SSO central
`auth.contentos.ch`. Pilotage par agent via serveur MCP. Voir
`../../docs/decisions/0002-comptes-operateur-audience-tenancy.md` (ADR-0002).

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `postgres`,
postgres-js) + **Tailwind 4**. Schéma dans `db/schema/`, client paresseux dans `db/index.ts`
(lit `DATABASE_URL` au runtime). Migrations SQL committées dans `drizzle/`.

```
ressources/
├── Dockerfile        multi-stage : deps → build → runner (standalone, non-root, :8080)
├── compose.yml       service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json          description + db:true + migrate
├── middleware.ts     pose le cookie de tracking sur /o/* ; SSO gate sur /admin /compte /bibliotheque
├── next.config.ts    output:"standalone"
├── drizzle/          migrations SQL committées (appliquées au déploiement)
├── scripts/migrate.mjs  applique drizzle/ à la base (migrator drizzle-orm/postgres-js)
├── scripts/backfill-operators.mjs  cutover prod single-tenant → multi-tenant (one-shot)
├── app/              App Router (dont healthz/route.ts → GET /healthz : 200 "ok", sans DB)
├── db/ lib/ components/  schéma, accès données, helpers auth/operator, UI
```

## Authentification — SSO contentos

Auth déléguée à `https://auth.contentos.ch` (cookie cross-subdomain `.contentos.ch`).
Les helpers vivent sous `lib/auth/` :

- `lib/auth/session.ts` : `getSession()`, `requireSession(target?)`, `getUserId()`,
  `requireUserId(target?)`, `signInUrl(target?)`. Fetch `${AUTH_URL}/api/auth/get-session`
  avec le cookie forwardé ; en preview, court-circuite avec `PREVIEW_USER_ID`.
  Le user porte un `accountType` (`operator | audience`, central — ADR-0002), exposé par
  `get-session` et relayé dans `Session.user.accountType`.
- `lib/auth/operator.ts` : `requireOperator()`, `getOperator()`, `getOperatorById(id)`,
  `operatorByHandle(handle)`. **La porte « opérateur » de ressources = présence d'une ligne
  `operators`** pour ce user (tenancy locale ; marche aussi pour le MCP qui ne porte que
  `userId`). Provisionnée en tandem avec `accountType='operator'` côté auth.
- `lib/auth/preview.ts` : `PREVIEW_USER_ID`, `isPreview` (selon `APP_ENV`). En preview, la
  session est court-circuitée en `operator` (l'opérateur démo `/o/demo`, seedé).
- `lib/mcp-auth.ts` : `verifyMcpToken(req)` via `${AUTH_URL}/api/auth/mcp/get-session` ; la
  route MCP exige en plus que le user soit **opérateur** et dépose `operatorId`/`handle` dans
  `authInfo.extra` (chaque outil n'opère que sur ses ressources).
- `app/.well-known/oauth-authorization-server` : 302 vers le provider central.
- `app/.well-known/oauth-protected-resource` : annonce `authorization_servers: [AUTH_URL]`.
- `app/connexion/page.tsx` : redirige vers `${AUTH_URL}/sign-in?redirect=...` (no-op en preview).

Modèle multi-tenant (ADR-0002) : un **opérateur** (table `operators`, `id` = user.id auth,
`handle` = slug d'espace) possède ses ressources (`resources.operator_id`, slug unique par
opérateur) et les édite via `/admin`. Les lecteurs qui accèdent à un espace deviennent son
**audience** (table `audience_members`, rattachée à l'opérateur) et peuvent s'abonner
(`subscriptions`). Toute requête est scopée `operator_id` (autorisation à la couche données).
`user_id`/operator `id` sont du text sans FK locale (le user vit dans la base auth).

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
`drizzle/` avant le démarrage.

`APP_URL` est auto-injecté par la plateforme (= origine publique du déploiement).

Les secrets viennent du coffre `ressources` de l'atelier (`/lab-secret`, scope `ressources`),
déchiffrés et injectés par `deploy.sh` :

- `AUTH_URL` — facultatif, défaut `https://auth.contentos.ch`.

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

Faire évoluer le schéma : éditer `db/schema/`, `npm run db:generate`, committer — le
prochain déploiement applique la migration.

## Vérifier visuellement (preview / dev)

En preview, `isPreview` court-circuite la session : tout requérant est auto-loggé comme
`PREVIEW_USER_ID = 'preview-user'`, **opérateur démo** (`/o/demo`, seedé avec ses ressources).
En prod, les visiteurs sont redirigés vers `${AUTH_URL}/sign-in?redirect=...` ; le SSO les
renvoie ensuite ici avec le cookie cross-subdomain. Le reader
(`app/(public)/o/[handle]/r/[slug]/`) adapte sa grille selon le nombre de pages / sections
(`components/reader/reader-shell.tsx`). Espace opérateur public sous `app/(public)/o/[handle]/` ;
admin scopé sous `app/admin/*` (dont `app/admin/audience/`) ; MCP sous
`app/api/[transport]/route.ts`. Liens legacy `/r/<slug>` → 301 vers `/o/<handle>/r/<slug>`.
