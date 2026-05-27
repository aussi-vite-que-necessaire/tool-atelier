# Gate CI « artefact unique » — design

## Objectif

Accélérer le pipeline `deploy.yml` (partagé par tous les projets) en supprimant le **double
`next build`** et en faisant du **deploy un simple pull**. Cible : ~5,5 min → ~3 min par push.
Conçu **remote-first** : tout tourne en CI, le local n'est qu'un accélérateur optionnel.

## Constat (mesuré)

- `next build` tourne **deux fois** par push : dans le job `test` (`npm run build` pour le smoke
  e2e) **et** dans `docker build` du job `deploy`.
- Le job `deploy` rebuild l'image complète (~3-3,5 min) alors qu'il pourrait juste la pull.
- Pas de cache de couches Docker ; navigateurs Playwright réinstallés à chaque run.
- Bug : le teardown d'une preview est annulé quand la suppression de branche coïncide avec un
  deploy prod (même groupe de concurrence `deploy-refs/heads/main`).

## Architecture cible

L'**image Docker est l'unité de vérité** : construite une fois, testée, puis pull au deploy.

```
detect ──┬── build (buildx + cache GHA → push :<env>)
         └── test  (host : unit + integration + worker)
                     │
build ────────────── e2e (docker run web+worker de l'image, e2e contre le conteneur)
                     │
build + test + e2e ── deploy (ssh deploy.sh → pull la même image)
```

Jobs (tous en matrice par projet changé, comme aujourd'hui) :

- **detect** — inchangé.
- **build** — `docker buildx build` avec `cache-from/to: type=gha`, **push** `ghcr.io/<owner>/atelier-<projet>:<env>`. Le seul `next build`. Tag `<env>` calculé dans le job (prod sur `main`, slug de branche sinon).
- **test** (host, parallèle de build) — `npm ci` (cache npm) → `npm test` (unit + integration + worker via vitest). **Aucun `next build`.**
- **e2e** (needs build ; seulement si `playwright.config.ts` présent) — `npm ci` + `db:test:prepare` (crée+migre `<projet>_test` sur le service Postgres) + cache navigateurs Playwright + pull l'image + `docker run` web et worker (réseau host, env de test) → `E2E_BASE_URL=… npm run test:e2e` (Playwright sur le host contre le conteneur).
- **deploy** (needs build + test + e2e) — `ssh deploy.sh <projet> <env> <image>` ; `deploy.sh` **pull** l'image déjà poussée (inchangé, il prend déjà l'image en argument). Affiche l'URL déployée dans le résumé GitHub.
- **teardown** — inchangé, **mais** sorti du groupe de concurrence qui collisionne (voir plus bas).

## Mode « serveur externe » pour Playwright

Pour que l'e2e teste le conteneur au lieu de lancer son propre serveur (et éviter un 2e build),
deux petits ajouts dans contentos, pilotés par `E2E_BASE_URL` :

- `playwright.config.ts` : `baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'` ; le
  bloc `webServer` n'est inclus **que si `E2E_BASE_URL` est absent** (en local, Playwright lance
  encore son serveur).
- `test/e2e/global-setup.ts` : si `E2E_BASE_URL` est défini, ne **pas** spawn le worker (il tourne
  comme conteneur en CI) ; sinon comportement actuel.

Aucune autre modification des specs.

## Orchestration e2e en CI (conteneur)

Services GitHub `postgres:17` + `redis:7` (ports mappés sur l'hôte). Étapes du job `e2e` :

1. `npm ci` puis `npm run db:test:prepare` (crée + migre `<projet>_test`).
2. Cache + `npx playwright install --with-deps chromium`.
3. `docker login ghcr.io` + `docker pull <image>`.
4. **web** : `docker run -d --network host -e PORT=3000 -e E2E_TESTING=true -e RESEND_API_KEY= -e CONTENT_OS_MEDIA_STUB=fs -e CONTENT_OS_LINKEDIN_STUB=1 -e DATABASE_URL=postgres://app:app@localhost:5432/<projet>_test -e REDIS_URL=redis://localhost:6379 -e APP_URL=http://localhost:3000 -e BETTER_AUTH_SECRET=ci-placeholder-secret-ci-placeholder <image>`.
5. **worker** : même chose avec `node worker-runner.mjs` en commande.
6. Attendre `GET http://localhost:3000/healthz` = 200 (timeout 60 s).
7. `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.
8. En cas d'échec : dump `docker logs` web + worker (diagnostic).

`--network host` : le conteneur joint les services Postgres/Redis via `localhost:5432/6379` (mappés
par GitHub). Le web écoute alors sur `localhost:3000` côté hôte ; Playwright (hôte) le joint.

L'image runner contient déjà `scripts/migrate.mjs`, `worker-runner.mjs` et la route
`__test__/emails` (gated `E2E_TESTING`) ; avec `RESEND_API_KEY` vide → inbox in-memory dans le
process web (le même qui sert la route de test), donc l'e2e récupère bien le code OTP.

## Quick wins additifs (inclus)

- **Cache Docker `type=gha`** (couche `npm ci` réutilisée tant que le lockfile ne bouge pas).
- **Cache navigateurs Playwright** (`actions/cache` sur `~/.cache/ms-playwright`, clé = version Playwright).
- **`cancel-in-progress` par branche** : `true` pour les branches (un nouveau push annule le run de
  preview précédent), `false` pour `main` (jamais annuler un deploy prod). Groupe :
  `deploy-${{ github.ref }}` + `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.
- **Fix concurrence teardown** : le job `teardown` (event `delete`) reçoit `github.ref = refs/heads/main`,
  donc collisionne avec le deploy prod. Le sortir du groupe partagé en lui donnant un groupe propre
  (`teardown-${{ github.event.ref }}`) au niveau job, ou en neutralisant la concurrence pour les
  events delete.
- **URL déployée dans le résumé GitHub** (`$GITHUB_STEP_SUMMARY`) côté deploy : un clic depuis le run.

## Sécurité / erreurs

- `deploy` gated sur `build + test + e2e` verts → une image qui rate les tests n'est jamais
  déployée. Un tag `:<env>` poussé puis recalé est inerte (seul `deploy.sh`, gated, le pull).
- Aucune fuite de secret : les valeurs CI sont des placeholders (`BETTER_AUTH_SECRET` factice),
  Postgres/Redis sont éphémères.

## Validation (cycle complet jusqu'à prod)

`detect` ne déclenche `build/test/e2e/deploy` que si un **projet** change. La branche de validation
inclut donc un changement **réel mais trivial** dans `contentos/` (commentaire) pour exercer tout
le pipeline : preview déployée via le nouveau flux + e2e contre conteneur, puis mesure des temps.
Le merge en `main` déclenche un **deploy prod** de contentos via le nouveau pipeline (comportement
applicatif inchangé — l'image est identique fonctionnellement). Avant push, on prouve l'e2e en
conteneur **en local** (build image + run web/worker + `E2E_BASE_URL`) pour minimiser les
itérations CI.

## Périmètre

- `.github/workflows/deploy.yml` — refonte des jobs.
- `contentos/playwright.config.ts` + `contentos/test/e2e/global-setup.ts` — mode serveur externe.
- `contentos/` — un commentaire trivial pour exercer le pipeline (déployé en prod, sans effet).
- **Pas** de changement à `Dockerfile` ni `deploy.sh`.
- Branche dédiée `work/ci-fast-gate`, PR.
