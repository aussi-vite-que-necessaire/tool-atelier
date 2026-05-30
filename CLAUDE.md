# Contentos — suite d'outils pour agents IA

Projet exploratoire. **Suite d'outils pensés pour être pilotés par des agents IA**, focalisée sur la production de contenu généré par IA en gardant un maximum de contrôle côté humain. **La suite est une seule application Next.js, à la racine du dépôt** (cast, media, ressources, skills, endpoint MCP, espace public docs), avec une navbar suite pour passer d'un domaine à l'autre. Un build, une base Postgres, un schéma Drizzle, une session d'authentification, une preview par branche. Le code de l'app vit à la racine (`src/`, `drizzle/`, `public/`, `compose.yml`, `Dockerfile`, `lab.json`, configs) ; `bin/`, `scripts/`, `secrets/`, `tools/`, `docs/`, `test/`, `.github/` sont la plomberie de l'atelier qui l'entoure.

Le déployable s'appelle **`app`** et sert l'apex **`contentos.ch`** (+ `www.contentos.ch`) en prod — déclaré par `"apex": true` dans `lab.json`. Un nouveau domaine de la suite = une **section/module** de l'app (route group + `src/lib/<domaine>/` + tables + outils MCP), pas un nouveau projet.

## Comment on travaille

- **Le dev de feature passe par le workflow superpowers** (plugin `superpowers`, installé via le marketplace `superpowers-marketplace`). C'est lui qui mène brainstorm → plan → implémentation en TDD. On le laisse faire ; pas de pipe maison par-dessus.
- **Surcouche IMPÉRATIVE à superpowers — un seul arrêt humain, puis on file jusqu'à la PR.** Cette règle **prime sur la procédure superpowers et la contraint** : superpowers garde la main sur le *comment* (brainstorm → plan → TDD), mais le *jusqu'où* est fixé ici. **Le seul moment où tu m'interromps, c'est la phase de questions du brainstorming.** Tant que tu as des questions pour cerner l'intention, le besoin et le design, tu les poses. **Dès que tu as fini de poser tes questions et que tu t'apprêtes à rédiger le plan, tu ne t'arrêtes plus :** tu rédiges le plan, tu implémentes en TDD, tu commit, tu push (→ preview) **et tu vas jusqu'à ouvrir la PR**, d'une traite. Sur ce trajet, les garde-fous superpowers qui rendent la main sont **désactivés** : pas de validation du plan à demander, pas de checkpoint d'exécution (`executing-plans`), pas de menu d'options de fin (`finishing-a-development-branch`) — tu enchaînes d'office.
  - **PR ouverte → tu t'abonnes d'office à sa CI.** Dès que la PR existe, tu appelles `subscribe_pr_activity` (CI + commentaires de revue) **sans jamais me demander si je veux que tu surveilles** — c'est systématique, ce n'est pas une option. Puis tu rends la main et tu restes dessus *jusqu'au vert* : à chaque événement, tu corriges les échecs CI et tu traites les retours de revue au fil de l'eau (selon le protocole d'événements PR du harness). **Tu ne merges ni ne promeus jamais toi-même** : le merge (→ intégration) et la promotion (→ prod) restent mon choix (l'entonnoir PR → merge → promotion de l'atelier).
  - **Le récap, c'est seulement quand la PR est « finie » — CI verte, preview en ligne et vérifiée.** Pas à l'instant où tu ouvres la PR : d'ici là tu enchaînes en silence (au plus une ligne « PR ouverte, je surveille la CI » avant de rendre la main au webhook). Quand le vert tombe, tu m'envoies **un seul** récap : ce que tu as fait, les points de vigilance, **puis les liens pour tester en toute dernière ligne du message** — d'abord l'URL de preview `https://app-<branche>.preview.contentos.ch`, puis le lien de la PR, et **rien après**. Comme ça je reçois la notif et le lien est tout en bas de la conversation, prêt à cliquer.
  - **Seule exception au non-arrêt :** un blocage *dur* (une info indispensable que tu ne peux ni déduire ni trancher raisonnablement). Là tu signales et tu demandes ; sinon tu décides et tu avances.
- **L'atelier ajoute quelques skills dédiées** à sa plomberie :
  - `/noter-idee` — capturer une piste d'amélioration en backlog (`docs/ideas/`) ;
  - `/travailler-infra` — bosser sur l'atelier lui-même (skills, `CLAUDE.md`, scripts, hooks, CI) ;
  - `/apercu` — l'œil de l'agent sur le front : rendre une page, la screenshoter (Chromium headless local) et la **voir** pour critiquer son rendu avant de pousser (`bin/apercu`) ;
  - `lab-ssh` — exécuter une commande de diagnostic sur le serveur `lab` (`bin/lab-ssh`).
- **Qualité front — l'œil de l'agent (RÉFLEXE).** Par défaut tu codes le front **à l'aveugle** : `npm run dev` rend la page, mais rien ne la regarde, et la seule preview visuelle arrive après push (boucle longue). **Toute modif qui change un rendu visuel se termine par un coup d'œil** : tu lances le serveur de dev, tu screenshotes avec `/apercu` (Chromium headless dans le conteneur, mobile **et** desktop), tu **Read** le PNG pour le *voir*, tu critiques (hiérarchie, espacement, responsive, états, cohérence), tu corriges, tu re-screenshotes — *puis* tu pousses. C'est un automatisme du trajet, pas une étape qui rend la main (cf. la surcouche « un seul arrêt humain »). On *match the codebase* : on s'aligne sur le thème et les composants existants de l'app.

## L'application

Plateforme de création, planification et publication de contenu LinkedIn pilotée par agent (module historique **cast**), augmentée des modules **media** (studio visuel) et **ressources**. Tous les outils de la suite sont exposés par un **endpoint MCP in-app unique**, `/api/mcp`.

### Deux process

- **web** : serveur Next standalone (`server.js`, port 8080). CMD par défaut de l'image.
- **worker** : consumers BullMQ (`src/worker/index.ts`, lancé via `worker-runner.mjs`) pour les files `dummy` et `publish-linkedin`. Service `worker` du `compose.yml`, même image, commande overridée.

Les files BullMQ sont **préfixées** (`QUEUE_PREFIX`, défaut `cast`) car le Redis lab est central/multi-tenant — enqueue (web) et consume (worker) partagent le même préfixe.

### Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres, schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **BullMQ + ioredis**. **Auth intégrée in-app** : BetterAuth tourne dans cette app (`src/lib/auth.ts`, adapter Drizzle sur le client local, email/mot de passe, champ `role` défaut `operator`), une seule origine (`env.APP_URL`), mêmes tables (`src/lib/db/schemas/auth.ts` : user/session/account/verification), une seule session. Handler monté sous `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`), client `src/lib/auth-client.ts`, page de connexion `/signin`. `src/lib/auth/session.ts` lit la session localement (`auth.api.getSession`). En preview, `/preview-login` ouvre une vraie session pour l'opérateur de test seedé (`/preview-logout` la ferme et pose le marqueur chooser) ; en prod, connexion normale par `/signin`. Migrations SQL committées dans `drizzle/`, appliquées au déploiement par le one-shot `scripts/migrate.mjs` (`drizzle-orm/node-postgres`, deps de prod — pas de drizzle-kit). `GET /healthz` → `ok` sans DB.

### Média — module in-app (`src/lib/media/`, section `/media`)

Le moteur média vit **dans cette app** (`src/lib/media/`) : génération/édition Gemini (`gemini.ts`), rendu HTML→image via le Chromium partagé (`render.ts`, `BROWSER_URL`), agrégation PDF (`pdf.ts`), stockage R2/S3 (`storage.ts`), galerie + styles + chartes + templates Handlebars (`repository.ts`, `styles.ts`, `style-guides.ts`, `brand.ts`, `templates/`). Tables clé par `user_id` dans `src/lib/db/schemas/media.ts` (`media`, `visual_styles`, `style_guides`, `visual_templates`, `brand`). `config.ts` dégrade proprement si un secret manque (jamais de throw au boot ; `CONTENT_OS_MEDIA_STUB=1` force le mode dégradé). La section UI est `src/app/(app)/media/*` (galerie, templates, styles, chartes, marque), sous-nav locale, AppShell partagé.

Un post **référence** un média via des colonnes (`mediaUrl`, `mediaKind`, `mediaWidth`, `mediaHeight`, `mediaId` optionnel). On attache un média :

- **UI** : le picker (`posts/[id]/_components/media-picker.tsx`) liste les médias de l'utilisateur par **requête DB directe** (server action `searchMediaAction` → `@/lib/media/catalog`) et appelle `setPostMedia`. « Créer un média » renvoie vers la section `/media/gallery` (in-app). Pas d'iframe, pas de postMessage, pas de self-call HTTP.
- **MCP** : `attach_media_to_post` / `detach_media` (attache) et les outils du moteur (`generate_image`, `render_html`, `create_pdf`, styles/chartes/templates…) sont enregistrés dans le registre MCP in-app (`src/lib/mcp/tools/media-engine.ts`), servis par l'endpoint `/api/mcp`, `userId` issu de la session.

La publication LinkedIn récupère les octets par `fetch(mediaUrl)` (`src/lib/media/fetch-bytes.ts`, URL R2 publique) et mappe `mediaKind → LinkedIn` (`pdf→document`, `video→video`, `image|render→image`).

### Endpoint MCP (`src/lib/mcp/`)

Un **registre unique** (`registry.ts`) capture **tous** les outils de la suite — cast (posts, config, voices, publishing), media (moteur visuel + attache), ressources — au chargement du module, sans dépendre du transport (`server.ts` → `registerAllTools`). `internal.ts` en dérive le catalogue (`listToolsResponse` : nom + description + JSON Schema) et l'exécution par nom (`callToolByName`, qui revalide les args en Zod).

L'endpoint public de la suite est **`/api/mcp`** (`src/app/api/mcp/route.ts`) :

- `GET` → catalogue de tous les outils.
- `POST { name, args, userId? }` → exécute un outil.
- **Auth** (`src/lib/mcp/endpoint-auth.ts`, pure et testée) : la **session de la suite** (cookie BetterAuth) est prioritaire → `userId` résolu côté serveur (`auth.api.getSession`), le `userId` du corps est ignoré. À défaut, un **canal de confiance** — bearer `MCP_INTERNAL_KEY` (prod) ou preview ouverte — honore le `userId` du corps. Pas d'OAuth.

`/internal/tools` (GET liste + POST `[name]`, garde `allowInternal`, `userId` dans le corps) reste comme variante interne pour un appelant programmatique de confiance ; il partage le même registre et la même garde bearer/preview que `/api/mcp`.

### Skill agentique

Le skill `content-os-redaction` (cerveau éditorial qui pilote cast et media via MCP) vit dans le hub in-app de la suite : `src/lib/skills/catalog/content-os-redaction/`. Le hub `/skills` liste tous les skills (catalogue lu à chaud) et permet leur téléchargement en ZIP (`/skills/[name]/download`), gardé par la session de la suite.

### Faire évoluer le schéma

Éditer `src/lib/db/schema.ts` / `src/lib/db/schemas/`, `npm run db:generate`, committer — le prochain déploiement applique la migration.

## Workflow & isolation — RÈGLE ABSOLUE

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise par l'entonnoir PR → merge (intégration) → promotion → prod.

- **Une session = un conteneur isolé = une branche.** Chaque session tourne dans son propre conteneur (un clone frais et jetable du dépôt, sur `claude.ai/code`) sur sa propre branche, fournie par le harness. L'isolation est **structurelle** : un agent est seul dans son conteneur, il peut éditer ce qu'il veut et basculer de branche sans gêner personne. Pas de worktree git, pas de checkout partagé.
- **On code sur sa branche de session, on ouvre une PR.** Pas de commit direct sur `main` dans le flux normal : `main` est le palier d'intégration, alimenté par les merges de PR.
- **Push de branche → preview par-branche** : `https://app-<branche>.preview.contentos.ch` (la suite entière, isolée, base dédiée seedée ; détruite à la suppression de la branche).
- **Merge de PR → `main` = palier d'intégration** : `https://app.preview.contentos.ch`, base `app_integration` persistante, seed plus riche + e2e. C'est le palier stable où l'on valide avant prod.
- **Promotion explicite → prod** : `https://contentos.ch` (+ `www.contentos.ch`), via le workflow `promote` (`workflow_dispatch`) qui **re-tague les images `:integration` validées en `:prod` sans rebuild** (on promeut l'artefact exact testé). Prod n'est jamais un envoi auto au merge.
- **Merger** : `gh pr merge <#> --squash` (→ intégration). La branche distante se supprime seule (`delete_branch_on_merge`) ; le conteneur de la session est jetable, rien à nettoyer côté local.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`lab-ssh`), secrets (`bin/lab-secret-add`), logs. La clé SSH du lab est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. `lab-ssh` transite par un tunnel WebSocket sur 443 (`ops.contentos.ch`, secret `sysadmin/WSTUNNEL_PATH`) là où le port 22 sortant est fermé — sessions cloud —, sinon en SSH direct ; local et cloud ont les mêmes privilèges.

## Déployer (build sur la CI uniquement)

`git push` → GitHub Action build l'image **web + worker** → **GHCR** → SSH vers `lab` → `scripts/deploy.sh`. Le serveur ne build jamais : il *pull* l'image déjà construite. Suivre avec `gh run watch`. Logs : `bin/lab-ssh "docker logs app-<env>-app-1"` (ou `-worker-1`).

**Trois paliers.** Push de branche → **preview par-branche** (`env` = slug de branche, `app-<branche>.preview.contentos.ch`). Merge sur `main` → **intégration** (`env=integration`, `app.preview.contentos.ch`, base persistante + e2e). Promotion (workflow `promote`, `workflow_dispatch`) → **prod** (`env=prod`, `contentos.ch`) : re-tag GHCR `:integration`→`:prod` (`docker buildx imagetools create`, sans rebuild) puis `deploy.sh app prod`. `APP_URL` étant injecté au runtime via `.env`, la même image se reconfigure d'un palier à l'autre — d'où la promotion sans rebuild.

**DNS.** Deux wildcards Infomaniak sur `contentos.ch` : `*.contentos.ch` (prod) et `*.preview.contentos.ch` (previews) pointent sur le lab — aucun enregistrement DNS par environnement. La zone est pilotable via l'API Infomaniak (token `sysadmin/INFOMANIAK_API_TOKEN`).

## Données — `lab.json`

L'app déclare ses besoins dans **`lab.json`** (à la racine) :
`{ "description": "...", "apex": true, "db": true, "redis": true, "browser": true, "email": true, "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed-preview.mjs", "worker": "node worker-runner.mjs", "images": ["web", "worker"] }`

Au déploiement, `deploy.sh` :
- crée la base `app_<env>` (Postgres central) si `db: true`, injecte `DATABASE_URL`, lance `migrate` puis `seed` (hors prod) ;
- `redis: true` → `REDIS_URL` + `REDIS_PREFIX` ;
- `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (Resend, clé de plateforme) ;
- `browser: true` → `BROWSER_URL` (Chromium partagé browserless sur le réseau `lab`) ;
- injecte toujours **`APP_URL`** = origine publique du déploiement (`https://app-<branche>.preview.contentos.ch` en preview par-branche, `https://app.preview.contentos.ch` en intégration, `https://contentos.ch` en prod via `apex`).

Preview par-branche = base vide + seed, droppée au teardown. Intégration = base `app_integration` + seed, **persistante** (pas de teardown).

**Dev (agents & local).** La même déclaration `lab.json` alimente l'environnement de dev — pensé d'abord pour les **agents en session cloud** (conteneur isolé, sans daemon Docker). `scripts/dev-db.sh up` monte Postgres (et Redis) en **natif** (serveur installé via apt si absent, cluster Debian démarré ; pas de Docker), crée le rôle applicatif `app` (convention de l'atelier, identique à la CI) puis `app_dev` **et** `app_test`, joue `migrate`+`seed` sur la base dev et `db:test:prepare` sur la base test, et écrit le `.env` (`DATABASE_URL`/`REDIS_URL` en `localhost`, `APP_URL`, `BETTER_AUTH_SECRET` de dev). Résultat : `npm run dev` **et** `npm test` partent du premier coup. Calque le modèle de la prod. Idempotent. `reset` repart de zéro, `down` arrête les services (données conservées), `nuke` drop les bases. *(e2e Playwright = hors de ce périmètre : ils tournent en CI post-deploy contre la preview/intégration.)*

## Secrets

Les clés API et variables sensibles sont des secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable `LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `app`). On les ajoute avec `bin/lab-secret-add`. Au déploiement, `deploy.sh` déchiffre et injecte `global` + le scope `app`. Les variables auto-fournies (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `BROWSER_URL`, `RESEND_API_KEY`) ne sont pas à gérer à la main. Secrets applicatifs : `BETTER_AUTH_SECRET` (requis), `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET`/`LINKEDIN_API_VERSION`, `TOKEN_ENCRYPTION_KEY`, `GEMINI_API_KEY`, `R2_*`, `MCP_INTERNAL_KEY` (scope `global`), `QUEUE_PREFIX`.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : gérés **hors de l'atelier**, pas ici.
