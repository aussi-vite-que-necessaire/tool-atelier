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

## Média — module in-app (`src/lib/media/`, section `/media`)

Le moteur média vit **dans cette app** (`src/lib/media/`) : génération/édition Gemini
(`gemini.ts`), rendu HTML→image via le Chromium partagé (`render.ts`, `BROWSER_URL`),
agrégation PDF (`pdf.ts`), stockage R2/S3 (`storage.ts`), galerie + styles + chartes +
templates Handlebars (`repository.ts`, `styles.ts`, `style-guides.ts`, `brand.ts`,
`templates/`). Tables clé par `user_id` dans `src/lib/db/schemas/media.ts` (`media`,
`visual_styles`, `style_guides`, `visual_templates`, `brand`). `config.ts` dégrade
proprement si un secret manque (jamais de throw au boot ; `CONTENT_OS_MEDIA_STUB=1` force
le mode dégradé). La section UI est `src/app/(app)/media/*` (galerie, templates, styles,
chartes, marque), sous-nav locale, AppShell partagé.

Un post **référence** un média via des colonnes (`mediaUrl`, `mediaKind`, `mediaWidth`,
`mediaHeight`, `mediaId` optionnel). On attache un média :

- **UI** : le picker (`posts/[id]/_components/media-picker.tsx`) liste les médias de
  l'utilisateur par **requête DB directe** (server action `searchMediaAction` →
  `@/lib/media/catalog`) et appelle `setPostMedia`. « Créer un média » renvoie vers la
  section `/media/gallery` (in-app). Pas d'iframe, pas de postMessage, pas de self-call HTTP.
- **MCP** : `attach_media_to_post` / `detach_media` (attache) et les outils du moteur
  (`generate_image`, `render_html`, `create_pdf`, styles/chartes/templates…) sont enregistrés
  dans le registre MCP in-app (`src/lib/mcp/tools/media-engine.ts`), servis par
  `/internal/tools`, `userId` issu de la session.

La publication LinkedIn récupère les octets par `fetch(mediaUrl)` (`src/lib/media/fetch-bytes.ts`,
URL R2 publique) et mappe `mediaKind → LinkedIn` (`pdf→document`, `video→video`,
`image|render→image`).

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres,
schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **BullMQ + ioredis**.
**Auth intégrée in-app** : BetterAuth tourne dans cette app (`src/lib/auth.ts`, adapter Drizzle
sur le client local, email/mot de passe, champ `role` défaut `operator`), une seule origine
(`env.APP_URL`), mêmes tables (`src/lib/db/schemas/auth.ts` : user/session/account/verification),
une seule session. Handler monté sous `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`),
client `src/lib/auth-client.ts`, page de connexion `/signin`. `src/lib/auth/session.ts` lit la
session localement (`auth.api.getSession`). En preview, `/preview-login` ouvre une vraie session
pour l'opérateur de test seedé (`/preview-logout` la ferme et pose le marqueur chooser) ; en prod,
connexion normale par `/signin`. L'auth MCP (OAuth) est centralisée à la
passerelle `mcp.contentos.ch` ; cast n'expose que `/internal/tools` (clé partagée), et ses tools
reçoivent le `userId` transmis (`src/lib/mcp/auth.ts` → `userIdFrom`). Migrations SQL committées
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

`lab.json` déclare `"db": true` + `"redis": true` + `"browser": true` → la plateforme crée la
base `<projet>_<env>` (Postgres central), provisionne Redis et injecte **`DATABASE_URL`**,
**`REDIS_URL`**, **`BROWSER_URL`** (Chromium partagé browserless, pour le rendu HTML→image) et
**`APP_URL`** = l'origine déployée par environnement. Le one-shot `migrate` applique `drizzle/`
avant le démarrage.

Les autres secrets viennent du coffre de l'atelier (scope `app` + `global`), déchiffrés et
injectés par `deploy.sh` :

- `BETTER_AUTH_SECRET` — secret de signature des sessions BetterAuth (auth in-app). Requis.
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` — publication LinkedIn
- `TOKEN_ENCRYPTION_KEY` — chiffrement des tokens LinkedIn stockés
- `GEMINI_API_KEY` — génération/édition d'image (module media). Absent → génération désactivée.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` —
  stockage R2/S3 des médias. Incomplet → studio média en mode dégradé.
- `MCP_INTERNAL_KEY` — clé interne partagée (scope **global**) gardant `/internal/tools` (passerelle MCP) ; court-circuitée en preview
- `QUEUE_PREFIX` — défaut `cast` (à laisser tel quel sauf collision)
- stubs CI/dev : `CONTENT_OS_AI_STUB`, `CONTENT_OS_LINKEDIN_STUB`, `CONTENT_OS_MEDIA_STUB`

Faire évoluer le schéma : éditer `src/lib/db/schema.ts` / `src/lib/db/schemas/`,
`npm run db:generate`, committer — le prochain déploiement applique la migration.
