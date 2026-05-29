# Refonte — suite Contentos en une app Next.js unique

État cible. Ce document décrit l'architecture telle qu'elle doit être, pas la migration.

## Intention

Contentos est un SaaS d'outils de production de contenu assistée par IA, piloté autant
par des agents que par des humains. La suite réunit trois domaines — **cast** (publication
LinkedIn), **media** (génération/édition de visuels), **ressources** (lead magnets) — plus un
hub de **skills** agentiques et un endpoint **MCP**. Une **navbar suite** en tête permet de
passer d'un domaine à l'autre ; la suite s'étend en ajoutant des entrées.

Tout vit dans **une seule application Next.js** : un build, une base Postgres, un schéma
Drizzle, une session d'authentification, une preview par branche. `docs` — l'espace public
de lecture que les clients offrent à leur audience — est un **groupe de routes public de la
même app**, avec sa propre mise en page et sans authentification opérateur.

## Principes

- **Simplicité d'abord.** La solution la plus simple qui marche. Pas de pont inter-services,
  pas d'iframe exposée, pas d'IDP distinct, pas de passerelle MCP distante : tout est local.
- **Un domaine = un module.** `src/modules/<domaine>/` regroupe le schéma, la logique, les
  composants et les outils MCP d'un domaine. Frontières nettes, testables isolément.
- **Clé par `userId`.** Chaque ressource appartient à un utilisateur. Un client = un compte.
  Les orgs/équipes sont un ajout futur non bloquant.
- **TDD.** Chaque tranche est développée test-d'abord (unit + intégration ; e2e en CI).

## Architecture

### Application

Next.js (App Router, React 19, TypeScript, Tailwind). Une seule app déployable.

Groupes de routes :

- `(public)` — landing marketing à `/` (ancien `www`), pages publiques. Sans auth.
- `(docs)` — espace public de lecture pour l'audience des clients. Mise en page propre,
  sans auth opérateur. Sert `docs.contentos.ch` (réécriture host → groupe). Lit le contenu
  publié (ressources/pages) depuis la base partagée.
- `(app)` — la suite authentifiée. **AppShell** commun + **navbar suite** (cast / media /
  ressources / skills) + drawer mobile.
  - `/cast/*` — posts, calendrier, paramètres (marque, voix, gabarits d'écriture, connexions
    LinkedIn). Worker de jobs (file Redis).
  - `/media/*` — galerie, génération/édition d'image (Gemini), rendu HTML→image (Chromium
    partagé), marques, styles, gabarits.
  - `/ressources/*` — admin des lead magnets (ressources, pages, audience, paramètres).
  - `/skills` — hub des skills agentiques de la suite.
  - `/styleguide` — vitrine vivante du design system (route in-app, pas un build séparé).
- `app/api/*` — route handlers : auth, callbacks LinkedIn, jobs, API `/v1` media, endpoint MCP.

### Authentification

BetterAuth, **une seule session**. Un champ `role` sur l'utilisateur distingue les niveaux
(opérateur de la suite vs, si besoin, lecteur). `docs` et `(public)` sont publics. En preview,
auto-login d'un opérateur de test seedé (boucle d'itération courte pour les agents).
`baseURL` = `APP_URL`. Plus d'`AUTH_URL` externe, plus de SSO cross-subdomain.

### Données

Une base `contentos_<env>` (Postgres central). Un schéma Drizzle **modulaire** :
`src/modules/<domaine>/schema.ts`, agrégés dans `src/db/schema.ts`. Tables clé par `userId`.
**Migrations idempotentes** (la base preview survit aux redéploiements : `when` croissants,
DDL idempotent). Un `migrate` et un `seed` uniques pour toute la suite. Seed preview = base
vide + opérateur(s) de test + jeu de données réaliste.

### Worker & services

- **Worker** (cast) : process séparé du même codebase (`src/worker/`), même image, second
  conteneur. File Redis (BullMQ).
- **Chromium** (media) : browserless partagé de la plateforme (`BROWSER_URL`).
- **Email** (auth/notifications) : Resend (clé plateforme).

`lab.json` unique : `{ db:true, redis:true, browser:true, email:true, images:["web","worker"],
migrate, seed }`.

### MCP

Un **endpoint MCP in-app** (`app/api/mcp` ou `/mcp`), authentifié, qui expose les outils de
chaque domaine. Chaque module fournit ses outils (`src/modules/<domaine>/mcp.ts`) ; l'endpoint
les fédère **en local** (plus de passerelle distante, plus de `/internal/tools`).

## Infrastructure & pipeline

On **réutilise le pipeline prouvé de l'atelier** (CI → build image → GHCR → SSH lab →
`deploy.sh` = pull). On garde la convention `projects/<name>` mais avec **un seul projet**,
`projects/app`, qui prend l'**apex** `contentos.ch` (généralise le cas spécial `www`). C'est
la simplification voulue (la douleur était la *multiplicité*, pas le dossier `projects/`) sans
réécrire l'infra. Le flattening littéral à la racine du repo est un follow-up optionnel.

Adaptations `deploy.sh` / `deploy.yml` (sûres, vérifiables sur preview de branche) :
- apex → `projects/app` (au lieu de `www`).
- suppression de l'injection `AUTH_URL` (auth in-app, plus d'IDP).
- suppression des gardes obsolètes : `shared_guard` (schéma partagé ressources/docs) et
  `www_tools_guard` (liste dashboard générée) — caducs avec une app unique.

### Paliers d'environnement (cible)

1. **Preview par branche** — `app-<branche>.preview.contentos.ch`, **Postgres dédiée seedée**,
   testable isolément. *Vérifiable cette nuit (push de branche).*
2. **Intégration** — `preview.contentos.ch` (apex du wildcard preview) : la suite assemblée,
   seed plus riche + jeux e2e, où tournent les e2e. Alimenté par `main`.
3. **Prod** — `contentos.ch`, par **promotion explicite** (retag image intégration → prod,
   `workflow_dispatch`), pas au merge.

Le palier intégration + promote n'est **pas exerçable depuis une branche de feature** (exige un
merge sur `main`). Il est donc **conçu et implémenté mais à valider par Manu avant de s'y fier** ;
cette propriété rend prod *plus* sûre qu'aujourd'hui (aucun auto-deploy prod). Pour le lancement
initial, le merge de la PR de refonte déploie sur **intégration** ; un `promote` met en prod.

## Préservation du legacy

Tout le code actuel est préservé sur la branche **`legacy`** (poussée sur `origin`, = `main`
d'avant refonte). Le rebuild se fait sur la branche `refonte/suite-unifiee` : on retire les
anciens `projects/*` applicatifs et on construit `projects/app`, en s'inspirant du legacy pour
réimplémenter les features simplement. La plomberie (`bin/`, `secrets/`, `scripts/` adaptés,
CI adaptée, skills atelier) est conservée et mise à jour.

## Décomposition en phases

Chaque phase est livrable et commitée fréquemment. La PR s'ouvre après la Phase 2 et se
complète au fil des phases suivantes (la preview de branche se met à jour à chaque push).

- **Phase 0 — Reset.** `legacy` préservée (fait). Worktree `refonte/suite-unifiee`. Retrait des
  anciens projets applicatifs, mise en place du squelette `projects/app`.
- **Phase 1 — Fondation.** App Next.js, Tailwind + design system, AppShell + navbar suite +
  drawer mobile, BetterAuth (rôles, auto-login preview), schéma Drizzle modulaire + migrate +
  seed, `lab.json`, Dockerfile (web+worker), `compose.yml`, `dev-db` ok, `deploy.sh`/`deploy.yml`
  adaptés. **Critère : preview de branche en ligne, healthz vert, login opérateur ok.**
- **Phase 2 — Verticale `cast`.** Posts, calendrier, paramètres (marque/voix/gabarits/
  connexions), publication LinkedIn, worker de jobs, outils MCP cast. Tests verts. **→ PR ouverte.**
- **Phase 3 — Verticale `media`.** Galerie, génération/édition Gemini, rendu HTML→image,
  marques/styles/gabarits, API `/v1`, outils MCP media.
- **Phase 4 — Verticale `ressources` + `(docs)`.** Admin lead magnets + espace public de lecture.
- **Phase 5 — Finitions.** Hub `skills`, route `/styleguide`, endpoint MCP fédéré, landing
  `(public)`.
- **Phase 6 — Pipeline.** Palier intégration + `promote.yml` (conçu, à valider par Manu).

## Tests

- **Unit + intégration** par module, TDD, sous Vitest. Bases `app_dev`/`app_test` via `dev-db`.
- **e2e** Playwright en CI post-deploy contre la preview (smoke) puis l'intégration (complet).
- Chaque phase finit verte avant d'enchaîner.

## Non-objectifs (pour cette refonte)

- Orgs/équipes multi-tenant (reste clé par `userId`).
- Passerelle MCP distante, IDP séparé, SSO cross-subdomain (supprimés).
- Flattening littéral du repo à la racine (follow-up optionnel ; `projects/app` suffit).
- Parité exhaustive garantie en un run : on vise fondation + cast solides puis on enchaîne.
