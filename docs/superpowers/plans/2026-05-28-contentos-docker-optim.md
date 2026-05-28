# Plan — contentos : optimisation Docker / CI

Plan d'exécution pour la spec
[`2026-05-28-contentos-docker-optim-design.md`](../specs/2026-05-28-contentos-docker-optim-design.md).

## Étapes

### 1. `contentos/package.json` — déplacer `tsx` en `dependencies`

- Retirer `tsx` de `devDependencies`.
- Ajouter `tsx` (même version) à `dependencies`.
- Régénérer `package-lock.json` (`npm install --package-lock-only`).

### 2. `contentos/Dockerfile` — refonte multi-target

Remplacer en entier par le pattern multi-stage alpine + 2 targets finales (`web`,
`worker`). Stages partagés `deps`, `build`, `proddeps` (ressources/Dockerfile sert de
référence — on l'étend juste avec une seconde target).

### 3. `contentos/lab.json` — déclarer `images: ["web", "worker"]`

Ajout du champ. Garder les autres clés telles quelles.

### 4. `contentos/compose.yml` — référencer `IMAGE_WEB` / `IMAGE_WORKER`

- Service `app` (web) : `image: ${IMAGE_WEB:?IMAGE_WEB manquant}`.
- Service `worker` : `image: ${IMAGE_WORKER:?IMAGE_WORKER manquant}`.

### 5. `.github/workflows/deploy.yml` — buildx + cache GHA + multi-target

- Job `build` :
  - Remplacer le `docker build` brut par `docker/setup-buildx-action@v3` +
    `docker/build-push-action@v6`.
  - Boucle bash sur `images` extrait de `lab.json` (fallback `["app"]` = comportement
    actuel mono-image).
  - Pour chaque target : build avec `--target=<role>` (sauf en mono-image où on ne
    passe pas `--target`), tag `atelier-<projet>(-<role>)?:env`, push.
  - `cache-from: type=gha`, `cache-to: type=gha,mode=max,scope=<projet>-<role>` pour
    éviter d'invalider entre projets ou rôles.
- Sortie du job `build` : `images` (str au format `ghcr.io/...` ou
  `web=ghcr.io/...,worker=ghcr.io/...`).
- Job `test` : ajouter `actions/cache@v4` pour `${{ matrix.project }}/.next/cache`,
  clé sur `package-lock.json`.
- Job `deploy` : passer `IMAGES` au lieu de `IMAGE` au `deploy.sh` (3e argument).

### 6. `scripts/deploy.sh` — accepter mono ou multi-image

- Détecter le format du 3e argument : présence d'un `=` au début → multi-image.
- Mono : `IMAGE=<ref>` dans `.env`, `docker pull <ref>`, `migrate` sur `<ref>`
  (comportement actuel).
- Multi : parser `role=ref,role=ref`, pull chaque image, injecter `IMAGE_<ROLE>=...`
  dans `.env` (uppercase), `migrate` utilise l'image `web`.

### 7. Sanity local

Comme on n'a pas de docker daemon dans le container Claude :

- Vérifier la syntaxe `npm ci` après changement package-lock (commande dans CI = ok).
- Vérifier le YAML du workflow (`gh workflow view` ou `actionlint` si présent).
- Pas de build local — la mesure se fait dans la CI sur la branche.

### 8. Commit, push, preview, PR

- Commit unique par fichier-groupe :
  - Dockerfile + package.json + lock + lab.json + compose.yml (contentos).
  - Workflow + deploy.sh (plomberie).
- Push `claude/contentos-docker-optim` → preview `https://contentos-claude-contentos-docker-optim.lab.avqn.ch`.
- Suivre la CI (`gh run watch`).
- Ouvrir la PR avec un tableau « avant / après » des chiffres (image size, build time).

### 9. Mesure avant/après

- **Avant** (référence) : sur `main`, dernier run CI de `contentos`. Récupérer image
  size depuis GHCR + durée du job `build`.
- **Après** : sur la PR, deuxième run (premier = chaud), durée du job `build` et taille
  des deux nouvelles images via `gh api /orgs/.../packages/...` ou inspection GHCR.

## Risques et plans B

- **`docker compose -f compose.yml`** se plaint d'une variable manquante au pull → on
  ajoute des valeurs par défaut (`${IMAGE_WEB:?}`) pour fail fast avec un message
  clair.
- **`tsx` en `dependencies`** pourrait introduire une dep de chargement TypeScript dans
  le bundle Next côté serveur — risque très faible (tsx n'est pas importé dans `src/`),
  vérifier que `next build` ne se plaint pas.
- **Cache GHA limité à 10 GB par repo** — peu probable d'atteindre la limite avec un
  seul projet, mais à surveiller si on généralise à tous (PR2). Scope du cache par
  projet/rôle pour éviter l'éviction croisée.
- Si `gh api` ne renvoie pas la taille d'image, mesurer via `docker images` localement
  après pull (`docker image inspect <ref> --format '{{.Size}}'`), peut être fait sur lab
  via `/lab-ssh`.
