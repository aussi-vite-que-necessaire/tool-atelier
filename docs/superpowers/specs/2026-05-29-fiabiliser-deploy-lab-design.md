# Fiabiliser l'étape `deploy` (lab) — design

**Date.** 2026-05-29
**Statut.** Validé, prêt pour implémentation
**Idée source.** `docs/ideas/2026-05-29-fiabiliser-deploy-lab.md`

## Problème

Tout le build se fait en CI ; le lab ne fait que `docker pull` + lancer les conteneurs.
Mais l'étape `deploy` (pull + conteneur one-shot `migrate` + `compose up`) s'exécute **sur le
lab**, et plante de façon transitoire :

1. **`docker pull` GHCR flaky** — échec ponctuel du pull, sans retry → deploy raté.
2. **Collisions inter-sessions** — `max-parallel: 1` ne sérialise que *dans un run* CI. Deux
   branches/agents qui poussent en même temps lancent deux `deploy.sh` concurrents sur le **même
   daemon Docker** du lab : pression RAM (~300 Mo libres / 3,7 Go constatés) + erreurs de lease
   containerd (« lease does not exist »). Résultat : environnements à moitié déployés.

## Décisions (validées)

- **Périmètre :** retry/backoff sur `docker pull` **+** verrou global inter-sessions. Pas de
  supervision RAM (backlog), pas de palier d'intégration (backlog).
- **Verrou : `flock` inline** sur `/opt/lab/deploy.lock`. Primitive noyau, libérée
  automatiquement à la mort du process (jamais de verrou fantôme), bloquante avec timeout,
  couvre **toutes** les sources de deploy (CI et lancement opérateur manuel).
- **Granularité : globale** — un seul deploy à la fois sur tout le lab, quels que soient
  projet/branche/env. C'est ce qui colle au diagnostic (la pression RAM et les leases viennent
  des opérations *concurrentes entre projets*).
- **Contention : attente bloquante** avec timeout généreux (600 s par défaut). Au-delà → échec
  visible (`::error::` + `exit 1`) plutôt que pendre indéfiniment.
- **`teardown.sh` prend le même verrou** — c'est le même daemon Docker (la ressource mutable de
  l'Étoile polaire). Les sérialiser ensemble est cohérent et quasi gratuit.

## Composants

### 1. `retry_pull <ref>` (dans `scripts/deploy.sh`)

Fonction inline. 3 tentatives, backoff exponentiel 2 s → 4 s → 8 s. Message `::error::` explicite
à l'épuisement, renvoie non-zéro (→ `set -e` fait échouer le deploy proprement). Variables
ajustables pour les tests : `PULL_MAX_ATTEMPTS` (défaut 3), `PULL_BACKOFF_BASE` (défaut 2).

La boucle existante `for ref in "${REFS[@]}"; do docker pull "$ref"; done` devient
`… retry_pull "$ref"`.

### 2. `acquire_deploy_lock` (dans `scripts/deploy.sh` ET `scripts/teardown.sh`)

```sh
acquire_deploy_lock() {
  exec 9>"${DEPLOY_LOCKFILE:-/opt/lab/deploy.lock}"
  flock -w "${DEPLOY_LOCK_TIMEOUT:-600}" 9 \
    || { echo "::error::verrou deploy non acquis après ${DEPLOY_LOCK_TIMEOUT:-600}s"; exit 1; }
}
```

- Appelée **tôt** : juste après le parsing des args / calcul des hosts, **avant** tout
  `docker pull` / `docker exec` / `compose`.
- Le fd 9 reste ouvert toute la durée du process → verrou tenu jusqu'à la sortie (libéré par le
  noyau, même en cas de crash).
- `DEPLOY_LOCKFILE` / `DEPLOY_LOCK_TIMEOUT` surchargeables pour les tests.

### 3. Scripts source-safe (testabilité)

`retry_pull` et `acquire_deploy_lock` définies en **haut** de chaque script, suivies d'un garde
idiomatique qui stoppe quand le fichier est *sourcé* (test) sans toucher l'exécution réelle :

```sh
# Sourcé (tests) : on s'arrête après les définitions de fonctions.
(return 0 2>/dev/null) && return 0
```

Le corps exécutable (deploy/teardown réel) reste intact en dessous.

## Données / flux

Inchangé hormis : chaque invocation de `deploy.sh`/`teardown.sh` acquiert le verrou global avant
de toucher Docker, et chaque `docker pull` passe par `retry_pull`. `max-parallel: 1` reste
(défense en profondeur intra-run) ; le `flock` ajoute la sérialisation inter-runs/sessions.

## Gestion d'erreur

- Pull définitivement échoué → `retry_pull` renvoie non-zéro → `set -euo pipefail` arrête le
  deploy avant tout `compose up` (pas d'env à moitié monté).
- Verrou non acquis sous 600 s → `exit 1` avec `::error::` (signal d'un vrai blocage).
- Process tué pendant qu'il tient le verrou → le noyau le libère (fd fermé), pas de blocage des
  deploys suivants.

## Tests (`test/deploy-retry.test.sh`, calqué sur `test/guard.test.sh`)

Source `deploy.sh`/`teardown.sh` avec des stubs `docker`/`flock`/`sleep` sur le `PATH` :

1. `retry_pull` réussit après N échecs simulés, sans dormir réellement (stub `sleep`).
2. `retry_pull` échoue (non-zéro) après `PULL_MAX_ATTEMPTS` tentatives.
3. `acquire_deploy_lock` réussit quand `flock` rend 0.
4. `acquire_deploy_lock` échoue (`exit 1`) quand `flock` rend non-zéro.
5. Le garde source-safe : sourcer le script ne déclenche aucun deploy.

Plus `shellcheck` sur `deploy.sh` et `teardown.sh`. Pas de test e2e du deploy complet (dépend du
lab — périmètre des e2e post-deploy, hors sujet).

## Hors périmètre

Supervision/alerte RAM du lab, palier d'intégration `preview.contentos.ch`, e2e mutualisés —
notés en backlog, pas dans ce chantier.
