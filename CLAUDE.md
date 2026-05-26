# tool-atelier — routeur de l'atelier

Monorepo incubateur. **Un dossier = un projet** (ex. `hello/`), avec son propre `CLAUDE.md`.
Pour bosser sur un projet : ouvre son dossier, l'agent en charge le `CLAUDE.md` à la volée.

## Déployer (build sur la CI uniquement — jamais en local ni sur le serveur)

- `git push` sur `main` → déploie le(s) projet(s) modifié(s) en **prod** : `<projet>.lab.avqn.ch`.
- `git push` sur une autre branche → **preview** : `<projet>-<branche>.lab.avqn.ch` (base/seed
  isolés à venir en plan 2b ; détruite à la suppression de la branche).
- Suivre le déploiement : `gh run watch` (la CI build l'image, la pousse sur GHCR, SSH vers
  `lab`, `deploy.sh`). Le serveur ne build jamais : il *pull* l'image déjà construite.

## Monitorer un déploiement

- CI : `gh run list` / `gh run watch <id>`.
- Sur `lab` (logs/statut d'un projet) : voir le `CLAUDE.md` du projet concerné.

## Créer un projet

Pour l'instant : copier `hello/` (template minimal). À terme : verbe cockpit `lab-new <nom>`.

## Données & secrets (plan 2b)

Un projet qui a besoin de Postgres → base `<projet>_<env>` dans le Postgres central de `lab` ;
Redis → namespace `<projet>:<env>:`. Secrets → projet Infisical `incubator`, dossier `<projet>`.
