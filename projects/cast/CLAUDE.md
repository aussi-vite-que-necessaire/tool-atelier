# cast — atelier de publication LinkedIn

Projet **cast** de la suite **contentos** (`cast.contentos.ch`). Plateforme de création,
planification et publication de contenu LinkedIn, pilotée par agent. Ses tools sont exposés
par la **passerelle MCP centrale** (`mcp.contentos.ch`) ; cast les publie via un **endpoint
interne** `/internal/tools` (clé partagée `MCP_INTERNAL_KEY`, court-circuitée en preview),
sans serveur MCP public ni OAuth local.

## Deux process

- **web** : serveur Next standalone (`server.js`, port 8080). CMD par défaut de l'image.
- **worker** : consumers BullMQ (`src/worker/index.ts`, lancé via `worker-runner.mjs`) pour
  les files `dummy` et `publish-linkedin`. Service `worker` du `compose.yml`, même image,
  commande overridée.

Les files BullMQ sont **préfixées** (`QUEUE_PREFIX`, défaut `cast`) car le Redis lab est
central/multi-tenant — enqueue (web) et consume (worker) partagent le même préfixe.

## Média — délégué à `media`

cast **ne crée aucun média** (pas de génération, templates, styles, chartes, PDF, upload) :
tout ça vit dans le service **media** (`https://media.contentos.ch`). Un post **référence** un
média via des colonnes (`mediaUrl`, `mediaKind`, `mediaWidth`, `mediaHeight`, `mediaId` optionnel).
On attache un média :

- **UI** : le picker (`posts/[id]/_components/media-picker.tsx`) a deux onglets. *Choisir*
  liste les médias de `media` (`GET /v1/media`, via `src/lib/media-catalog/`) et appelle
  `setPostMedia`. *Créer un média* embarque en **iframe** la page `/embed/new` de `media`
  (`${MEDIA_ENGINE_URL}/embed/new?parentOrigin=…`) — parité totale avec sa modal d'ajout
  (upload, génération IA, PDF, template). À la création, l'iframe `postMessage`
  `{ type: 'contentos:media-created', media }` ; cast valide `event.origin`, puis
  `attachCreatedMediaAction` construit le `MediaRef` **depuis le payload** (pas de round-trip
  `/v1` → indépendant du userId/preview) et l'attache. Contrat : `src/lib/media-link/embed.ts`.
- **MCP** : `attach_media_to_post` (par `media_id` du service, ou n'importe quelle `media_url`) et
  `detach_media`. L'agent trouve les médias via le connecteur MCP de `media`.

La publication LinkedIn récupère les octets par `fetch(mediaUrl)` (`src/lib/media-catalog/fetch-bytes.ts`)
et mappe `mediaKind → LinkedIn` (`pdf→document`, `video→video`, `image|render→image`).

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres,
schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **BullMQ + ioredis**.
Sessions web déléguées à **`auth.contentos.ch`** (cookie cross-subdomain `.contentos.ch`) —
`src/lib/auth/session.ts` lit la session via fetch HTTP. L'auth MCP (OAuth) est centralisée à la
passerelle `mcp.contentos.ch` ; cast n'expose que `/internal/tools` (clé partagée), et ses tools
reçoivent le `userId` transmis (`src/lib/mcp/auth.ts` → `userIdFrom`). Voir
`docs/superpowers/specs/2026-05-28-cast-sso-migration-design.md`. Migrations SQL committées
dans `drizzle/`, appliquées au déploiement par le one-shot `scripts/migrate.mjs`
(`drizzle-orm/node-postgres`, deps de prod — pas de drizzle-kit). `GET /healthz` → `ok` sans DB.

## Skill agentique

Le skill `content-os-redaction` (cerveau éditorial qui pilote cast et media via MCP) vit dans le
hub central de l'atelier : `skills/skills/content-os-redaction/`. Téléchargeable sur
`https://skills.contentos.ch` après connexion OTP.

## Déployer (via l'atelier)

`git push` sur une branche → preview `https://cast-<branche>.preview.contentos.ch`. Merge de la PR
→ prod sur **`https://cast.contentos.ch`**. Jamais de commit direct sur `main`. La CI de l'atelier
build l'image (`docker build`) → GHCR → pull sur `lab` ; le serveur ne build jamais.

La plateforme injecte `APP_URL` (cf. `deploy.sh`) = l'URL preview en preview,
`https://cast.contentos.ch` en prod. La passerelle `mcp.contentos.ch` joint `/internal/tools` de
cast sur cette même origine (preview de la même branche, ou prod).

## Données & secrets

`lab.json` déclare `"db": true` + `"redis": true` → la plateforme crée la base
`<projet>_<env>` (Postgres central) + provisionne Redis et injecte **`DATABASE_URL`** et
**`REDIS_URL`** automatiquement. Elle injecte aussi **`APP_URL`** = l'origine déployée par
environnement. Le one-shot `migrate` applique `drizzle/` avant le démarrage.

Les autres secrets viennent du coffre `cast` de l'atelier (`/lab-secret`, scope `cast`),
déchiffrés et injectés par `deploy.sh` :

- `AUTH_URL` — URL du provider d'auth de la suite (défaut `https://auth.contentos.ch`).
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` — publication LinkedIn
- `TOKEN_ENCRYPTION_KEY` — chiffrement des tokens LinkedIn stockés
- `MEDIA_ENGINE_SERVICE_KEY` — Bearer du service **media** (`https://media.contentos.ch`) :
  lecture du catalogue (`GET /v1/media`) pour le picker. L'URL du service est codée en défaut
  (`MEDIA_ENGINE_URL` = `https://media.contentos.ch`, surchargeable par env pour le dev local)
- `MCP_INTERNAL_KEY` — clé interne partagée (scope **global**) gardant `/internal/tools` (passerelle MCP) ; court-circuitée en preview
- `QUEUE_PREFIX` — défaut `cast` (à laisser tel quel sauf collision)
- stubs CI/dev : `CONTENT_OS_AI_STUB`, `CONTENT_OS_LINKEDIN_STUB`

Faire évoluer le schéma : éditer `src/lib/db/schema.ts` / `src/lib/db/schemas/`,
`npm run db:generate`, committer — le prochain déploiement applique la migration.
