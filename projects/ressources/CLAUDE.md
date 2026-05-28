# ressources

Plateforme de lead magnets de la suite **contentos** (`https://ressources.contentos.ch`).
Une ressource = une arborescence de pages faites de modules typés, servie sur `/r/<slug>`
par un reader SSR. Authentification déléguée au SSO central `auth.contentos.ch`. Pilotage
par agent via serveur MCP.

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `postgres`,
postgres-js) + **Tailwind 4**. Schéma dans `db/schema/`, client paresseux dans `db/index.ts`
(lit `DATABASE_URL` au runtime). Migrations SQL committées dans `drizzle/`.

```
ressources/
├── Dockerfile        multi-stage : deps → build → runner (standalone, non-root, :8080)
├── compose.yml       service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json          description + db:true + migrate
├── middleware.ts     pose le cookie de tracking sur /r/* ; SSO gate sur /admin /compte /bibliotheque
├── next.config.ts    output:"standalone"
├── drizzle/          migrations SQL committées (appliquées au déploiement)
├── scripts/migrate.mjs  applique drizzle/ à la base (migrator drizzle-orm/postgres-js)
├── app/              App Router (dont healthz/route.ts → GET /healthz : 200 "ok", sans DB)
├── db/ lib/ components/  schéma, accès données, helpers auth/admin, UI
```

## Authentification — SSO contentos

Auth déléguée à `https://auth.contentos.ch` (cookie cross-subdomain `.contentos.ch`).
Les helpers vivent sous `lib/auth/` :

- `lib/auth/session.ts` : `getSession()`, `requireSession(target?)`, `getUserId()`,
  `requireUserId(target?)`, `signInUrl(target?)`. Fetch `${AUTH_URL}/api/auth/get-session`
  avec le cookie forwardé ; en preview, court-circuite avec `PREVIEW_USER_ID`.
- `lib/auth/admin.ts` : `userIsAdmin(id)` (via env `ADMIN_USER_IDS`) et `requireAdmin()`.
- `lib/auth/preview.ts` : `PREVIEW_USER_ID`, `isPreview` (selon `APP_ENV`).
- `lib/mcp-auth.ts` : `verifyMcpToken(req)` via `${AUTH_URL}/api/auth/mcp/get-session`
  (le MCP exige en plus que le user soit admin).
- `app/.well-known/oauth-authorization-server` : 302 vers le provider central.
- `app/.well-known/oauth-protected-resource` : annonce `authorization_servers: [AUTH_URL]`.
- `app/connexion/page.tsx` : redirige vers `${AUTH_URL}/sign-in?redirect=...` (no-op en preview).

Modèle single-tenant : seul l'admin (un user.id frappé par `auth.contentos.ch`, listé dans
`ADMIN_USER_IDS`) édite les ressources. Les autres comptes connectés ne sont que des
visiteurs qui peuvent s'abonner à une ressource (table `subscriptions`, `user_id` text sans
FK locale puisque le user vit dans la base auth).

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

- `ADMIN_USER_IDS` — IDs (auth.contentos.ch) autorisés à accéder à l'admin et au MCP,
  séparés par virgules. Ex. `mPNwuxFCfdhF5jriE1dqkWCdgcIjsiQ5`.
- `AUTH_URL` — facultatif, défaut `https://auth.contentos.ch`.

Faire évoluer le schéma : éditer `db/schema/`, `npm run db:generate`, committer — le
prochain déploiement applique la migration.

## Vérifier visuellement (preview / dev)

En preview, `isPreview` court-circuite la session : tout requérant est auto-loggé comme
`PREVIEW_USER_ID = 'preview-user'`, qui est admin par défaut. En prod, les visiteurs sont
redirigés vers `${AUTH_URL}/sign-in?redirect=...` ; le SSO les renvoie ensuite ici avec le
cookie cross-subdomain. Le reader (`app/(public)/r/[slug]/`) adapte sa grille selon le
nombre de pages / sections (`components/reader/reader-shell.tsx`). Admin sous `app/admin/*` ;
MCP sous `app/api/[transport]/route.ts`.
