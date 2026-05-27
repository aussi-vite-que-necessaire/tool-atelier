# Gate CI rapide — design

## Objectif

Réduire la latence du pipeline `deploy.yml` (partagé par tous les projets) : on attend trop
longtemps entre un push et la preview/prod. Conçu **remote-first** : tout tourne en CI, le local
n'est qu'un accélérateur optionnel.

## Constat (mesuré)

L'ancien pipeline était **séquentiel** : `test` (~130 s, inclut un `next build` pour le smoke
e2e) **puis** `deploy` (~190-215 s, refait un `docker build` complet = `npm ci` + `next build` +
push, puis SSH). Total ~330-367 s. Le `next build` tournait deux fois, mais surtout **bout à
bout** : c'est le séquençage, pas le double build, qui coûte la latence.

Autres points : pas de cache de couches Docker ; navigateurs Playwright réinstallés à chaque run ;
le teardown d'une preview annulé quand la suppression de branche coïncide avec un deploy prod
(même groupe de concurrence).

## Architecture

Le levier est le **parallélisme** : le build de l'image et la suite de tests n'ont aucune
dépendance entre eux, donc ils tournent en parallèle. Le deploy ne fait plus que *pull* l'image.

```
detect ──┬── build  (docker buildx + cache GHA → push :<env>)
         └── test   (host : unit + integration + worker + smoke e2e)
                          │
build + test ───────────── deploy  (ssh deploy.sh → pull l'image)
```

Jobs (matrice par projet changé) :

- **detect** — liste les projets changés (Dockerfile présent) ; sort aussi `env` (prod sur `main`,
  slug de branche sinon).
- **build** — `docker build` + push `ghcr.io/<owner>/atelier-<projet>:<env>`. Pas de cache de
  couches GHA : son export (toutes les couches, dont `node_modules`) pèse plus que le `npm ci`
  qu'il économise, surtout sur le chemin froid (1er push d'une branche, chaque prod).
- **test** (parallèle de build) — `npm ci` + `db:test:prepare` + unit/integration/worker + `next
  build` + smoke e2e (Playwright, navigateurs cachés). Le build host ne sert qu'au smoke e2e.
- **deploy** (needs build + test) — `ssh deploy.sh <projet> <env> <image>` ; `deploy.sh` fait un
  `docker pull` de l'image déjà poussée (inchangé). Affiche l'URL déployée dans le résumé GitHub.
- **teardown** (event delete) — inchangé.

Chemin critique ≈ `max(build, test) + deploy(pull)`. Le `next build` du job `test` chevauche le
`docker build` du job `build` : la latence ne le paie qu'une fois.

## Concurrence

```yaml
concurrency:
  group: deploy-${{ github.event_name }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

- `event_name` dans la clé : un event `delete` (`github.ref = refs/heads/main`) ne partage plus le
  groupe d'un push prod → le teardown ne se fait plus annuler.
- `cancel-in-progress` vrai hors `main` : repousser une branche annule le run de preview précédent
  (on ne build pas deux previews de la même branche en même temps). Jamais sur `main` : on
  n'interrompt ni un deploy prod ni un teardown.

## Quick wins additifs

- **Cache navigateurs Playwright** (`actions/cache` sur `~/.cache/ms-playwright`).
- **URL déployée dans le résumé GitHub** (`$GITHUB_STEP_SUMMARY`) : un clic depuis le run.

## Sécurité / erreurs

- `deploy` gated sur `build + test` verts → une image qui rate les tests n'est jamais déployée.
- Valeurs CI = placeholders (`BETTER_AUTH_SECRET` factice) ; Postgres/Redis éphémères.

## Coût / arbitrage

Le job `test` refait un `next build` (host) que le deploy n'utilise pas (il pull l'image du job
`build`). C'est un coût **compute** (deux builds), assumé pour gagner en **latence** : les deux
builds tournent en parallèle au lieu de bout à bout. Priorité explicite : réduire l'attente.

## Validation (cycle complet jusqu'à prod)

`detect` ne déclenche le pipeline que si un **projet** change. La branche de validation touche
`contentos/` pour l'exercer de bout en bout (preview déployée + smoke e2e), mesurer les durées par
job (cache froid puis chaud), puis le merge en `main` déclenche un **deploy prod** de contentos via
le nouveau pipeline. Le cache GHA est froid au premier build (export des couches) : le gain de
latence se mesure à **cache chaud**, régime permanent.

## Périmètre

- `.github/workflows/deploy.yml` — refonte des jobs (parallélisme + cache + concurrence + résumé).
- **Pas** de changement à `Dockerfile`, `deploy.sh`, ni au harnais de tests des projets.
- Branche dédiée `work/ci-fast-gate`, PR.
