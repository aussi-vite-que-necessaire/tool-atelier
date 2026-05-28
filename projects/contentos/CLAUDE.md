# contentos (copie lab)

Copie **lab** du produit ContentOS, tournant **en parallèle de la prod** sur
`https://contentos.lab.avqn.ch`. La prod (`contentos.avqn.ch`) n'est **jamais** touchée par
ce dossier : c'est un environnement d'itération isolé.

ContentOS = plateforme de création/planification/publication de contenu (LinkedIn), pilotée
par agent via un serveur **MCP** sur `/api/mcp` (OAuth via better-auth, `.well-known/`).

## Deux process

- **web** : serveur Next standalone (`server.js`, port 8080). CMD par défaut de l'image.
- **worker** : consumers BullMQ (`src/worker/index.ts`, lancé via `worker-runner.mjs`) pour
  les files `dummy` et `publish-linkedin`. Service `worker` du `compose.yml`, même image,
  commande overridée.

Les files BullMQ sont **préfixées** (`QUEUE_PREFIX`, défaut `contentos`) car le Redis lab est
central/multi-tenant — enqueue (web) et consume (worker) partagent le même préfixe.

## Média — délégué à `media`

ContentOS **ne crée aucun média** (pas de génération, templates, styles, chartes, PDF, upload) :
tout ça vit dans le service **media** (`https://media.lab.avqn.ch`). Un post **référence** un média
via des colonnes (`mediaUrl`, `mediaKind`, `mediaWidth`, `mediaHeight`, `mediaId` optionnel). On
attache un média :

- **UI** : le picker (`posts/[id]/_components/media-picker.tsx`) liste les médias de `media`
  (`GET /v1/media`, via `src/lib/media-catalog/`) et appelle `setPostMedia`.
- **MCP** : `attach_media_to_post` (par `media_id` du service, ou n'importe quelle `media_url`) et
  `detach_media`. L'agent trouve les médias via le connecteur MCP de `media`.

La publication LinkedIn récupère les octets par `fetch(mediaUrl)` (`src/lib/media-catalog/fetch-bytes.ts`)
et mappe `mediaKind → LinkedIn` (`pdf→document`, `video→video`, `image|render→image`).

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres,
schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **better-auth**
(`BETTER_AUTH_SECRET`, plugin MCP/OAuth) + **BullMQ + ioredis**. Migrations SQL committées
dans `drizzle/`, appliquées au déploiement par le one-shot `scripts/migrate.mjs`
(`drizzle-orm/node-postgres`, deps de prod — pas de drizzle-kit). `GET /healthz` → `ok` sans DB.


## Skill agentique

Le skill `content-os-redaction` (cerveau éditorial qui pilote ContentOS et media via MCP) vit dans le hub central de l'atelier : `skills/skills/content-os-redaction/`. Téléchargeable sur `https://skills.lab.avqn.ch` après connexion OTP.

## Déployer (via l'atelier)

`git push` sur une branche → preview `https://contentos-<branche>.lab.avqn.ch`. Merge de la PR
→ prod sur le domaine public **`https://contentos.avqn.ch`** (aussi joignable via
`contentos.lab.avqn.ch`). Jamais de commit direct sur `main`. La CI de l'atelier build l'image
(`docker build`) → GHCR → pull sur `lab` ; le serveur ne build jamais.

L'URL publique du MCP/OAuth correspond à l'origine déployée : la plateforme injecte `APP_URL` (cf.
`deploy.sh`) = l'URL preview en preview, et le domaine `domain` de `lab.json`
(`https://contentos.avqn.ch`) en prod ; `better-auth` s'aligne dessus.

## Données & secrets

`lab.json` déclare `"db": true` + `"redis": true` → la plateforme crée la base
`<projet>_<env>` (Postgres central) + provisionne Redis et injecte **`DATABASE_URL`** et
**`REDIS_URL`** automatiquement. Elle injecte aussi **`APP_URL`** = l'origine déployée par
environnement : l'URL preview en preview, le `domain` de `lab.json` (`contentos.avqn.ch`) en prod.
Le one-shot `migrate` applique `drizzle/` avant le démarrage.

Les autres secrets viennent de **`/opt/lab/secrets/contentos.env`** sur `lab` (posé hors
dépôt, jamais committé) :

- `BETTER_AUTH_SECRET` — signature des sessions (≥ 16 car. ; `openssl rand -base64 32`)
- `RESEND_API_KEY`, `RESEND_FROM` — email (sinon OTP loggé côté serveur)
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` — publication LinkedIn
- `TOKEN_ENCRYPTION_KEY` — chiffrement des tokens LinkedIn stockés
- `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY` — service **media** (`https://media.lab.avqn.ch`) :
  lecture du catalogue (`GET /v1/media`) pour le picker, et fetch des octets pour la publication
- `QUEUE_PREFIX` — défaut `contentos` (à laisser tel quel sauf collision)
- stubs CI/dev : `CONTENT_OS_AI_STUB`, `CONTENT_OS_LINKEDIN_STUB`

Faire évoluer le schéma : éditer `src/lib/db/schema.ts` / `src/lib/db/schemas/`,
`npm run db:generate`, committer — le prochain déploiement applique la migration.

<!-- redeploy: clés réelles (email + média) -->

<!-- go-live: APP_URL → contentos.avqn.ch -->
