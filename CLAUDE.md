# Contentos — suite d'outils pour agents IA

Projet exploratoire. **Suite d'outils pensés pour être pilotés par des agents IA**, focalisée sur la production de contenu généré par IA en gardant un maximum de contrôle côté humain. Monorepo : **un dossier dans `projects/` = un outil de la suite** (ex. `projects/hello/`, `projects/counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre. Le reste de la racine (`bin/`, `docs/`, `scripts/`, `secrets/`, `starters/`, `test/`, `tools/`) est la plomberie de l'atelier.

Les outils vivent sous `*.contentos.ch` en prod. Cas spécial : **`projects/www/`** sert `contentos.ch` + `www.contentos.ch`.

## Trois rails de session

| Skill | Quand |
|---|---|
| `/lab-ship <projet>` | Feature/évolution d'un projet existant (cadrage → spec → plan → impl → PR preview, un seul gate humain) |
| `/lab-new` | Créer un nouveau projet (base Next.js + capacités, déploiement jusqu'en prod) |
| `/lab-meta` | Plomberie de l'atelier (skills, `CLAUDE.md`, scripts, hooks) — flow libre |

Utilitaires : `/start` (router de session), `/lab-deploy` (déploie le projet courant), `/lab-secret` (secrets), `/lab-ssh` (diagnostic serveur), `/lab-adr <sujet>` (capture une décision structurante dans `docs/decisions/`), `/lab-idea <sujet>` (capture une piste en backlog dans `docs/ideas/`).

La liste des projets se déduit en scannant `projects/*/lab.json` — chaque projet déclare sa description dans son `lab.json`.

## Workflow & isolation — RÈGLE ABSOLUE

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise par l'entonnoir PR → merge → CI.

- **Jamais de commit sur `main`.** On code sur une branche, on ouvre une PR.
- **Push de branche → preview** : `https://<projet>-<branche>.preview.contentos.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.contentos.ch` (cas `www` → `contentos.ch` + `www.contentos.ch`).
- **Merger** : `gh pr merge <#> --squash`. La branche distante se supprime seule (`delete_branch_on_merge`). Côté local, `git worktree remove <chemin>` puis `git branch -D <branche>`. Pas de `--delete-branch` en contexte worktree (gh tente un checkout sur `main`, déjà occupé).
- **Une session = un worktree isolé + une branche.** Le checkout principal est réservé à la plomberie de l'atelier (CLAUDE.md, skills, scripts) — pas de dev projet. Le hook `branch-guard` bloque les commits sur `main`, les push qui mettraient `main` à jour, et le dev projet dans le checkout principal.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`/lab-ssh`), secrets (`/lab-secret`), logs. La clé SSH du lab est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. Local et cloud ont les mêmes privilèges.

## Déployer (build sur la CI uniquement)

`git push` → GitHub Action build l'image du/des projet(s) modifié(s) → **GHCR** → SSH vers `lab` → `scripts/deploy.sh`. Le serveur ne build jamais : il *pull* l'image déjà construite. Suivre avec `gh run watch`. Logs d'un projet : `lab-ssh "docker logs <projet>-<env>-app-1"` (skill `/lab-ssh`).

**DNS.** Deux wildcards Infomaniak sur `contentos.ch` : `*.contentos.ch` (prod) et `*.preview.contentos.ch` (previews) pointent sur le lab — aucun enregistrement DNS par projet. La zone est pilotable via l'API Infomaniak (token `sysadmin/INFOMANIAK_API_TOKEN`).

## Données — `lab.json`

Un projet déclare ses besoins dans **`lab.json`** :
`{ "description": "...", "db": true, "redis": false, "email": false, "browser": false, "migrate": "npm run migrate", "seed": "npm run seed" }`

Au déploiement, `deploy.sh` :
- crée la base `<projet>_<env>` (Postgres central) si `db: true`, injecte `DATABASE_URL`, lance `migrate` puis `seed` (hors prod) ;
- `redis: true` → `REDIS_URL` + `REDIS_PREFIX` ;
- `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (Resend, clé de plateforme) ;
- `browser: true` → `BROWSER_URL` (Chromium partagé browserless sur le réseau `lab`) ;
- injecte toujours **`APP_URL`** = origine publique du déploiement (`https://<projet>-<branche>.preview.contentos.ch` en preview, `https://<projet>.contentos.ch` en prod, cas `www` → `https://contentos.ch`).

Preview = base vide + seed, droppée au teardown. Exemples : `projects/hello/` (rien), `projects/counter/` (db).

**Dev (agents & local).** La même déclaration `lab.json` alimente l'environnement de dev — pensé d'abord pour les **agents en session cloud** (conteneur isolé, sans daemon Docker). `scripts/dev-db.sh up <projet>` monte Postgres (et Redis si déclaré) en **natif** (serveur installé via apt si absent, cluster Debian démarré ; pas de Docker), crée le rôle applicatif `app` (convention de l'atelier, identique à la CI) puis `<projet>_dev` **et** `<projet>_test`, joue `migrate`+`seed` sur la base dev et `db:test:prepare` sur la base test, et écrit le `.env` du projet (`DATABASE_URL`/`REDIS_URL` en `localhost`, `APP_URL`, `BETTER_AUTH_SECRET` de dev). Résultat : `npm run dev` **et** `npm test` passent du premier coup (vérifié de bout en bout, ardoise vierge, sur `cast` 169 tests, `media` 120, `ressources` 239 ; `auth`/`counter` provisionnés). Calque le modèle de la prod. Idempotent (à relancer si le conteneur a été recyclé). `reset <projet>` repart de zéro, `down` arrête les services (données conservées), `nuke <projet>` drop les bases du projet. `/lab-implémenter` lance ce `up` avant la première tâche. *(e2e Playwright = hors de ce périmètre : ils tournent en CI post-deploy contre la preview — cf. `docs/ideas/2026-05-28-e2e-mutualises.md`.)*

## Secrets — `/lab-secret`

Les clés API et variables sensibles se gèrent avec **`/lab-secret`** : secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable `LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `<projet>`). Au déploiement, `deploy.sh` déchiffre et injecte `global` + le scope du projet. Les variables auto-fournies (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) ne sont pas à gérer à la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : gérés **hors de l'atelier**, pas ici.
