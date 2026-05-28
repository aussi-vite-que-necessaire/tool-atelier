# Design — alléger les tests contentos + corriger l'APP_URL des previews

## Contexte

Deux frictions sur contentos :

1. **Build/tests pénibles.** La suite e2e (15 specs Playwright, ~41 tests) tourne en
   séquentiel, chaque spec bootant un serveur Next standalone complet + un worker. C'est lent,
   et surtout : la CI (`.github/workflows/deploy.yml`) ne lance **aucun test** — elle build
   l'image Docker et déploie. Les tests ne gardent donc rien ; ils ne servent qu'à ralentir le
   local. Les sessions cloud (`scripts/cloud-setup.sh`) n'ont ni Postgres ni Redis : elles ne
   peuvent de toute façon pas lancer les tests integration/e2e. « Discipline locale avant push »
   ne couvre jamais le cloud.

2. **APP_URL faux en preview.** `APP_URL` est requis (`src/lib/env.ts`, `z.string().url()`) et
   pilote `better-auth` (`baseURL`, `trustedOrigins`), le redirect OAuth LinkedIn et les URLs
   du media-engine. Il est lu au runtime depuis l'env, y compris par le **worker** (hors requête
   HTTP — donc impossible de le dériver d'en-têtes seuls). `scripts/deploy.sh` injecte
   `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY` automatiquement mais **pas `APP_URL`** : celui-ci
   est figé dans le secret statique `contentos.env.age`, donc une seule valeur. Les previews
   (`cast-<branche>.preview.contentos.ch`) héritent d'un `APP_URL` faux → auth, MCP et LinkedIn
   pointent vers la mauvaise origine.

## Objectifs

- Une suite de tests **rapide et utile** : elle garde prod et previews, quel que soit l'endroit
  où le code est écrit (cloud ou local).
- Un `APP_URL` **correct par environnement**, sans que la plateforme apprenne des variables
  projet par projet.

## 1. APP_URL — primitive générique injectée par la plateforme

L'origine publique d'un déploiement est une primitive universelle (comme `DATABASE_URL`) : seule
la plateforme la connaît, puisqu'elle attribue le host. `scripts/deploy.sh` calcule déjà `HOST`
par environnement (`<projet>-<branche>.preview.contentos.ch` en preview, `<projet>.contentos.ch` en prod lab).

**Changement.** Dans `deploy.sh`, après le bloc de déchiffrement des secrets `age`, injecter :

```sh
printf 'APP_URL=https://%s\n' "$HOST" >> "$APPDIR/.env"
```

L'injection se fait **après** les secrets : en `--env-file`, la dernière occurrence d'une clé
gagne, donc l'origine calculée par la plateforme est autoritative — un secret périmé ne peut plus
la masquer. C'est une ligne, inconditionnelle, valable pour tout projet ; le nom `APP_URL` devient
la convention plateforme pour « origine publique du déploiement ».

**Secret.** `APP_URL` est retiré de `contentos.env.age` (opération locale via `/lab-secret`, hors
session de build — voir Suivi).

**App.** Aucun changement de code. `env.APP_URL` reste requis et reçoit la bonne valeur par env.

**Docs.** `APP_URL` rejoint la liste des variables auto-injectées dans l'atelier `CLAUDE.md`
(§ Données — lab.json) ; il quitte la liste des secrets de contentos `CLAUDE.md`.

## 2. Tests — gate CI rapide + smoke e2e minimal

### 2.1 Réduire les e2e à un smoke

On garde **un seul** spec e2e, le plus dense en couverture de câblage :

| Garder | Pourquoi |
|--------|----------|
| `auth.spec.ts` | Exerce boot de l'app, `/signin`, pipeline email (endpoint `__test__`), magic-link, dashboard authentifié, logout, garde de route. Un seul test couvre la chaîne critique. |

On **supprime** les 14 autres : `calendar`, `carousel-video`, `ideas`, `image-edit`,
`linkedin-connection`, `linkedin-publish`, `media-gallery`, `post-image`, `post-visual`, `posts`,
`settings-brand`, `settings-editorial`, `template-image-var`, `visual-templates`. Leur logique
est déjà couverte par les ~47 tests d'intégration (server actions, repos, outils MCP).

`test/e2e/global-setup.ts` (démarrage du worker hors-bande) et `playwright.config.ts` restent.

### 2.2 Gate CI dans `deploy.yml`

Un job `test` s'intercale entre `detect` et `deploy`. Le job `deploy` dépend de `test`
(`needs: [detect, test]`) : pas de déploiement si les tests échouent. Le job est **générique** —
il lance le `npm test` de chaque projet changé et lit `lab.json` pour décider des services ; aucune
logique par projet.

Forme du job (matrice sur `needs.detect.outputs.projects`) :

- `services:` Postgres + Redis déclarés au niveau du job (toujours présents, ignorés par les
  projets qui n'en ont pas besoin). Postgres : `POSTGRES_USER=app`, `POSTGRES_PASSWORD=app`
  (l'app est superuser, peut créer `contentos_test` et se connecter à la base d'admin `postgres`).
- `npm ci` dans le dossier projet.
- Si `lab.json` déclare `db: true` : `npm run db:test:prepare` (crée + migre `<projet>_test`).
- `npm test` (unit + integration + worker) avec `--if-present` pour tolérer les projets sans tests.
- `npm run build --if-present` puis `npx playwright install --with-deps chromium` puis
  `npm run test:e2e --if-present` (le smoke unique). Ces étapes ne s'exécutent que si le projet
  définit les scripts correspondants.

`.env.test` (committé) force `DATABASE_URL` sur la base de test localhost ; en CI, le service
Postgres écoute sur `localhost:5432` avec les identifiants attendus.

**Coût.** Le smoke e2e impose un `next build` dans le job (en plus du build Docker du job
`deploy`). C'est accepté : un seul spec, et la duplication du build reste une optimisation future
(YAGNI). La cible reste un pipeline de quelques minutes.

## 3. Découpage & livraison

Tout sur la branche `work/contentos-optimiser-build-feature-preview`, une seule PR :
`scripts/deploy.sh`, `.github/workflows/deploy.yml`, suppression des 14 specs e2e, docs
(`CLAUDE.md` atelier + contentos). La preview de la branche utilise le `deploy.sh` de la branche
(copié par la CI), donc le correctif APP_URL est testable sur cette preview avant merge.

## Hors-scope / Suivi (toi, en local)

- Retirer `APP_URL` de `secrets/projects/contentos.env.age` via `/lab-secret` (session locale de
  confiance, pas une session de build).
- Le passage de la prod réelle vers `contentos.avqn.ch` (commentaire `go-live`) reste hors de ce
  dépôt : l'injection plateforme couvre les copies lab (preview + prod lab).

## Critères de réussite

- Une preview de branche sert `APP_URL = https://cast-<branche>.preview.contentos.ch` ; le flux OAuth
  MCP et le magic-link aboutissent sur cette origine.
- Un push qui casse un test (unit/integration/worker/smoke) **ne déploie pas**.
- La suite e2e locale et CI se limite au smoke `auth` et tourne en quelques secondes une fois le
  serveur démarré.
