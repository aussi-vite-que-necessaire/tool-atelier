# Contentos — suite d'outils pour agents IA

Projet exploratoire. **Suite d'outils pensés pour être pilotés par des agents IA**, focalisée sur la production de contenu généré par IA en gardant un maximum de contrôle côté humain. Monorepo : **un dossier dans `projects/` = un outil de la suite** (ex. `projects/hello/`, `projects/counter/`), avec son propre `CLAUDE.md` chargé à la volée quand on l'ouvre. Le reste de la racine (`bin/`, `docs/`, `scripts/`, `secrets/`, `starters/`, `test/`, `tools/`) est la plomberie de l'atelier.

Les outils vivent sous `*.contentos.ch` en prod. Cas spécial : **`projects/www/`** sert `contentos.ch` + `www.contentos.ch`.

## Comment on travaille

- **Le dev de feature passe par le workflow superpowers** (plugin `superpowers`, installé via le marketplace `superpowers-marketplace`). C'est lui qui mène brainstorm → plan → implémentation en TDD. On le laisse faire ; pas de pipe maison par-dessus.
- **Surcouche IMPÉRATIVE à superpowers — un seul arrêt humain, puis on file jusqu'à la PR.** Cette règle **prime sur la procédure superpowers et la contraint** : superpowers garde la main sur le *comment* (brainstorm → plan → TDD), mais le *jusqu'où* est fixé ici. **Le seul moment où tu m'interromps, c'est la phase de questions du brainstorming.** Tant que tu as des questions pour cerner l'intention, le besoin et le design, tu les poses. **Dès que tu as fini de poser tes questions et que tu t'apprêtes à rédiger le plan, tu ne t'arrêtes plus :** tu rédiges le plan, tu implémentes en TDD, tu commit, tu push (→ preview) **et tu vas jusqu'à ouvrir la PR**, d'une traite. Sur ce trajet, les garde-fous superpowers qui rendent la main sont **désactivés** : pas de validation du plan à demander, pas de checkpoint d'exécution (`executing-plans`), pas de menu d'options de fin (`finishing-a-development-branch`) — tu enchaînes d'office.
  - **Tu t'arrêtes à la PR ouverte + la preview en ligne** — **jamais de merge en prod** : le merge reste mon choix (c'est l'entonnoir PR → merge → CI de l'atelier).
  - **À la toute fin, et seulement là, tu m'envoies un récap** : ce que tu as fait, les points de vigilance, et **tous les liens pour tester** (URL de preview `https://<projet>-<branche>.preview.contentos.ch` + lien de la PR).
  - **Seule exception au non-arrêt :** un blocage *dur* (une info indispensable que tu ne peux ni déduire ni trancher raisonnablement). Là tu signales et tu demandes ; sinon tu décides et tu avances.
- **L'atelier ajoute quelques skills dédiées** à sa plomberie :
  - `/nouveau-projet` — créer un projet (base Next.js + capacités, déploiement jusqu'en prod) ;
  - `/noter-idee` — capturer une piste d'amélioration en backlog (`docs/ideas/`) ;
  - `/travailler-infra` — bosser sur l'atelier lui-même (skills, `CLAUDE.md`, scripts, hooks, CI) ;
  - `/apercu` — l'œil de l'agent sur le front : rendre une page, la screenshoter (Chromium headless local) et la **voir** pour critiquer son rendu avant de pousser (`bin/apercu`) ;
  - `lab-ssh` — exécuter une commande de diagnostic sur le serveur `lab` (`bin/lab-ssh`).
- **Qualité front — l'œil de l'agent (RÉFLEXE).** Par défaut tu codes le front **à l'aveugle** : `npm run dev` rend la page, mais rien ne la regarde, et la seule preview visuelle arrive après push (boucle longue). **Toute modif qui change un rendu visuel se termine par un coup d'œil** : tu lances le serveur de dev, tu screenshotes avec `/apercu` (Chromium headless dans le conteneur, mobile **et** desktop), tu **Read** le PNG pour le *voir*, tu critiques (hiérarchie, espacement, responsive, états, cohérence), tu corriges, tu re-screenshotes — *puis* tu pousses. C'est un automatisme du trajet, pas une étape qui rend la main (cf. la surcouche « un seul arrêt humain »). Le standard de jugement est **local au projet** : si le projet utilise `@contentos/ui`/son thème, aligne-toi dessus et réutilise l'existant ; sinon respecte son identité propre (`docs`, `www`). On *match the codebase*, on n'impose pas un look de suite.

La liste des projets se déduit en scannant `projects/*/lab.json` — chaque projet déclare sa description dans son `lab.json`.

## Workflow & isolation — RÈGLE ABSOLUE

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent par session ; la prod (singleton) se sérialise par l'entonnoir PR → merge → CI.

- **Une session = un conteneur isolé = une branche.** Chaque session tourne dans son propre conteneur (un clone frais et jetable du dépôt, sur `claude.ai/code`) sur sa propre branche, fournie par le harness. L'isolation est **structurelle** : un agent est seul dans son conteneur, il peut éditer n'importe quel projet et basculer de branche sans gêner personne. Pas de worktree git, pas de checkout partagé.
- **Jamais de commit sur `main`.** On code sur sa branche de session, on ouvre une PR. C'est le seul garde-fou du hook `branch-guard` : il bloque tout `commit`/`push` qui mettrait `main` à jour. Le reste est permis (le conteneur est privé).
- **Push de branche → preview** : `https://<projet>-<branche>.preview.contentos.ch` (détruite à la suppression de la branche).
- **Merge de PR → prod** : `https://<projet>.contentos.ch` (cas `www` → `contentos.ch` + `www.contentos.ch`).
- **Merger** : `gh pr merge <#> --squash`. La branche distante se supprime seule (`delete_branch_on_merge`) ; le conteneur de la session est jetable, rien à nettoyer côté local.
- **Opérer = une capacité, pas un lieu.** Toute session qui détient `LAB_SECRETS_KEY` est opérateur de plein droit : SSH lecture/diagnostic (`lab-ssh`), secrets (`bin/lab-secret-add`), logs. La clé SSH du lab est tirée du store (`sysadmin/LAB_SSH_KEY_B64`), déchiffrée en mémoire, utilisée, effacée. `lab-ssh` transite par un tunnel WebSocket sur 443 (`ops.contentos.ch`, secret `sysadmin/WSTUNNEL_PATH`) là où le port 22 sortant est fermé — sessions cloud —, sinon en SSH direct ; local et cloud ont les mêmes privilèges.

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

**Dev (agents & local).** La même déclaration `lab.json` alimente l'environnement de dev — pensé d'abord pour les **agents en session cloud** (conteneur isolé, sans daemon Docker). `scripts/dev-db.sh up <projet>` monte Postgres (et Redis si déclaré) en **natif** (serveur installé via apt si absent, cluster Debian démarré ; pas de Docker), crée le rôle applicatif `app` (convention de l'atelier, identique à la CI) puis `<projet>_dev` **et** `<projet>_test`, joue `migrate`+`seed` sur la base dev et `db:test:prepare` sur la base test, et écrit le `.env` du projet (`DATABASE_URL`/`REDIS_URL` en `localhost`, `APP_URL`, `BETTER_AUTH_SECRET` de dev). Résultat : `npm run dev` **et** `npm test` passent du premier coup (vérifié de bout en bout, ardoise vierge : `cast` 169 tests, `media` 72, `ressources` 81 — tous verts ; `auth`/`counter` provisionnés, sans suite testable). Calque le modèle de la prod. Idempotent (à relancer si le conteneur a été recyclé). `reset <projet>` repart de zéro, `down` arrête les services (données conservées), `nuke <projet>` drop les bases du projet. *(e2e Playwright = hors de ce périmètre : ils tournent en CI post-deploy contre la preview — cf. `docs/ideas/2026-05-28-e2e-mutualises.md`.)*

## Secrets

Les clés API et variables sensibles sont des secrets `age`-chiffrés versionnés dans `secrets/`, déverrouillés par l'unique variable `LAB_SECRETS_KEY`, par scope (`global` partagé / `sysadmin` opérateur / `<projet>`). On les ajoute avec `bin/lab-secret-add`. Au déploiement, `deploy.sh` déchiffre et injecte `global` + le scope du projet. Les variables auto-fournies (`APP_URL`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`) ne sont pas à gérer à la main.

## Infra / plateforme

Serveurs, DNS, Postgres/Redis centraux, firewall : gérés **hors de l'atelier**, pas ici.
