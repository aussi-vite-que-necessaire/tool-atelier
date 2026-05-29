# Contentos — suite d'outils pour agents IA

Projet exploratoire. **Suite d'outils pensés pour être pilotés par des agents IA**, focalisée sur la production de contenu généré par IA en gardant un maximum de contrôle côté humain. Monorepo : **un dossier dans `projects/` = un outil de la suite** (ex. `projects/hello/`, `projects/counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre. Le reste de la racine (`bin/`, `docs/`, `scripts/`, `secrets/`, `starters/`, `test/`, `tools/`) est la plomberie de l'atelier.

Les outils vivent sous `*.contentos.ch` en prod. Cas spécial : **`projects/www/`** sert `contentos.ch` + `www.contentos.ch`.

## Comment on travaille

- **Le dev de feature passe par le workflow superpowers** (plugin `superpowers`, installé via le marketplace `superpowers-marketplace`). C'est lui qui mène brainstorm → plan → implémentation en TDD. On le laisse faire ; pas de pipe maison par-dessus.
- **L'atelier ajoute quelques skills dédiées** à sa plomberie :
  - `/nouveau-projet` — créer un projet (base Next.js + capacités, déploiement jusqu'en prod) ;
  - `/noter-idee` — capturer une piste d'amélioration en backlog (`docs/ideas/`) ;
  - `/travailler-infra` — bosser sur l'atelier lui-même (skills, `CLAUDE.md`, scripts, hooks, CI) ;
  - `lab-ssh` — exécuter une commande de diagnostic sur le serveur `lab` (`bin/lab-ssh`).

La liste des projets se déduit en scannant `projects/*/lab.json` — chaque projet déclare sa description dans son `lab.json`.

## Workflow & isolation — RÈGLE ABSOLUE

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise par l'entonnoir PR → merge → CI.

- **Une session = un conteneur isolé = une branche.** Chaque session tourne dans son propre conteneur (un clone frais et jetable du dépôt, sur `claude.ai/code`) sur sa propre branche, fournie par le harness. L'isolation est **structurelle** : un agent est seul dans son conteneur, il peut éditer n'importe quel projet et basculer de branche sans gêner personne. Pas de worktree git, pas de checkout partagé.
- **Jamais de commit sur `main`.** On code sur sa branche de session, on ouvre une PR. C'est le seul garde-fou du hook `branch-guard` : il bloque tout `commit`/`push` qui mettrait `main` à jour. Le reste est permis (le conteneur est privé).
- **Push de branche → preview** : `https://<projet>-<branche>.preview.contentos.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.contentos.ch` (cas `www` → `contentos.ch` + `www.contentos.ch`).
- **Merger** : `gh pr merge <#> --squash`. La branche distante se supprime seule (`delete_branch_on_merge`) ; le conteneur de la session est jetable, rien à nettoyer côté local.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`lab-ssh`), secrets (`bin/lab-secret-add`), logs. La clé SSH du lab est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. Local et cloud ont les mêmes privilèges.

## Déployer (build sur la CI uniquement)

`git push` → GitHub Action build l'image du/des projet(s) modifié(s) → **GHCR** → SSH vers `lab` → `scripts/deploy.sh`. Le serveur ne build jamais : il *pull* l'image déjà construite. Suivre avec `gh run watch`. Logs d'un projet : `bin/lab-ssh "docker logs <projet>-<env>-app-1"`.

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

## Secrets

Les clés API et variables sensibles sont des secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable `LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `<projet>`). On les ajoute avec `bin/lab-secret-add`. Au déploiement, `deploy.sh` déchiffre et injecte `global` + le scope du projet. Les variables auto-fournies (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) ne sont pas à gérer à la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : gérés **hors de l'atelier**, pas ici.
