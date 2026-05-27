# Design — Collaboration multi-agents dans l'atelier

## Objectif

Plusieurs agents travaillent en parallèle sur l'atelier sans jamais se disputer une
ressource mutable — fichier, branche, base, déploiement, infra. Et n'importe quel
framework d'agents (superpowers ou un autre) accélère le travail sans posséder la
méthodologie.

## Principe directeur — l'atelier possède la méthodologie

La méthodologie vit dans l'atelier (`CLAUDE.md`, skills `lab-*`, hooks), **agnostique au
framework d'agents**. Un framework comme superpowers est un invité : il accélère, il ne
possède ni la topologie git, ni le flux de mise en ligne, ni l'accès à l'infra. Remplacer
le framework ne casse rien, parce que le contrat ne dépend d'aucun.

## Étoile polaire

**Deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et
la branche → isolation par session. L'infra partagée et singulière (la prod) → partition
ou sérialisation.

## Deux lieux d'exécution, deux rôles

| Rôle | Lieu | Pourquoi |
|---|---|---|
| **Construire** (code → preview → PR → prod) | **Cloud** (session cloud par tâche) | Isolation parfaite par construction, natif GitHub, aucun SSH requis : la CI détient `LAB_SSH_KEY` |
| **Opérer** le lab (logs, diagnostic, secrets, hands-on) | **Local de confiance** | Les clés SSH/age vivent là où on peut les tenir en sûreté |

Une session cloud n'a ni coffre à secrets chiffré, ni clé SSH privée, ni accès localhost :
ses variables d'environnement sont visibles. Elle **construit et pousse** ; elle ne tient
pas les clés du lab. La capacité opérateur n'est pas retirée à l'agent — elle vit dans
l'environnement de confiance (local) qui peut détenir la clé. Voir le déploiement
CI-piloté : `git push` suffit, l'agent n'a pas besoin de SSH pour livrer.

## L'isolation entre agents

- **Cloud** : chaque tâche = une session cloud isolée + sa branche → zéro collision de
  code ni de runtime entre agents, par construction.
- **Local** : chaque session = un worktree git isolé + sa branche. Le harness le fait
  nativement (sessions d'arrière-plan / vue agents, chacune dans son worktree). Le lanceur
  de l'atelier ajoute le vernis : nommage `work/<projet>-<libellé>`, garde-fou, ergonomie.
- **Règle dure** : jamais deux sessions d'écriture dans le **checkout principal**. Le
  checkout principal est une **base** d'où l'on lance des sessions et d'où l'on touche la
  plomberie de l'atelier (CLAUDE.md, skills, scripts) — jamais un lieu de dev de projet.

## Le lanceur local — `lab`

Un point d'entrée unique, à la fois menu CLI et commande, **double-cliquable** (un
`Atelier.command` dans le repo) et **relocalisable** (se localise via son propre chemin et
`git rev-parse --show-toplevel` ; aucun chemin en dur, survit à un déplacement du dossier).

| Commande | Effet |
|---|---|
| `lab new <projet> [libellé]` | Crée la branche `work/<projet>-<libellé>` + le worktree, dépose le terminal dedans, lance la session |
| `lab ls` | Liste les worktrees/sessions et leur branche, propre/sale |
| `lab cd <nom>` | Revient dans un worktree existant |
| `lab rm <nom>` | Retire un worktree (refuse si sale ou si une session y tourne) |

Le déplacement du terminal dans le worktree exige une **fonction shell** (un processus ne
peut pas `cd` son parent), sourcée une fois (`source <repo>/bin/lab-shell.sh`). La logique
(validation, `git worktree add`, nommage) vit dans `bin/lab` ; la fonction shell n'est
qu'un fin wrapper qui capture le chemin créé et y `cd`. Le lanceur s'appuie sur
l'isolation worktree native du harness plutôt que de la réimplémenter.

Worktrees sous `.claude/worktrees/<nom>/`, dans le repo (emplacement déjà utilisé par le
harness). `.claude/worktrees/` est dans `.gitignore` : les worktrees (copies du monorepo)
ne polluent ni `git status` ni les commits ; le reste de `.claude/` reste versionné.
`lab ls` et `scripts/cartography.sh` excluent `.claude/worktrees/`.

## Le garde-fou — hook

Un hook `PreToolUse` (sur `Write`, `Edit`, `Bash`) détecte le checkout principal partagé :

```
git rev-parse --git-dir  ==  git rev-parse --git-common-dir   → checkout principal
                         ≠                                     → worktree lié (OK)
```

Dans le checkout principal, il **refuse** de muter du code projet, `git switch`,
`git commit`/`git add` de code projet, avec le message « crée d'abord ton worktree :
`lab new <projet>` ». Zone d'exemption : lecture, `lab-*`, et l'édition des métas de
l'atelier (`CLAUDE.md`, `.claude/`, `docs/`, `bin/`, `scripts/`). C'est l'extension du
`branch-guard` actuel (qui bloque déjà commit/push sur `main`). Les worktrees liés et les
sessions cloud passent sans friction.

## Coordination de l'infra partagée

- **Preview** : isolée par branche (base `<projet>_<branche>`, sous-domaine, conteneur
  dédié). C'est le bac à sable runtime de chaque agent — il la mute librement.
- **Prod** : mutée **uniquement** par l'entonnoir `PR → merge → CI`, jamais en SSH
  ad-hoc. GitHub sérialise les merges, et le workflow porte déjà
  `concurrency: group: deploy-${{ github.ref }}` → un seul déploiement prod à la fois.
- **Lecture / diagnostic SSH** (`lab-ssh` : logs, `docker ps`) : libre, c'est le quotidien
  de l'opérateur local.
- **Bases** nommées `<projet>_<env>` → périmètres disjoints, pas de collision.
- **Partition** : on assigne aux agents des périmètres disjoints (projets différents) —
  sans conflit par construction plutôt que résolution de conflit.

## Cohabitation des frameworks invités

Pure précédence par `CLAUDE.md` (superpowers honore le `CLAUDE.md` utilisateur comme
priorité maximale). Aucun patch dans le framework.

| Skill superpowers | Comportement dans l'atelier |
|---|---|
| `using-git-worktrees` | Défère via le contrat `CLAUDE.md` ; détecte l'isolation déjà en place dans un worktree lié et ne crée pas d'arborescence parallèle |
| `finishing-a-development-branch` | Défère à `/lab-deploy` + PR (push = preview, merge = prod) |
| `dispatching-parallel-agents` | Conservée ; un agent = une session isolée |
| `using-superpowers`, TDD, brainstorming, plans… | Inchangées |

Brancher un autre framework demain ne demande que de lui faire lire le même `CLAUDE.md`.

## Setup cloud (monorepo)

- **Connexion une fois** : `/web-setup` (réutilise le token `gh`) ou l'app GitHub.
- **Lancer une tâche** : une commande qui ouvre une session cloud sur le repo, sur une
  branche, et ouvre une PR. (Flags exacts à confirmer au moment du setup.)
- **Monorepo** : un script de setup d'environnement cloud fait les installs par
  sous-projet (`npm ci` ciblé). Limite de build du cache ~5 min.
- **Secrets cloud** = variables d'environnement (visibles, non chiffrées). On n'y met donc
  **ni** la clé SSH du lab **ni** `LAB_SECRETS_KEY` : le cloud construit, il n'opère pas.

## Surface à construire

- `CLAUDE.md` : section « Collaboration multi-agents » (étoile polaire, le découpage
  construire/opérer, le contrat, la cohabitation des invités).
- `bin/lab` (+ `bin/lab-shell.sh`) : lanceur local relocalisable et double-cliquable
  (`Atelier.command`), appuyé sur l'isolation worktree native.
- `.gitignore` : ajout de `.claude/worktrees/`.
- Hook `PreToolUse` garde-fou + zone d'exemption (extension de `branch-guard`).
- Script de setup d'environnement cloud + doc `/web-setup`.
- `lab-list` (skill) et `scripts/cartography.sh` : exclure `.claude/worktrees/`.

Pas de désactivation de superpowers, pas de conteneur local maison (le cloud assure déjà
l'isolation totale), aucune nouvelle dépendance.

## Hors scope

- Lire les logs du lab depuis une session cloud : on opère en local de confiance.
- Conteneur local par session (YAGNI tant que cloud et Dev Containers existent).
- Ne jamais supprimer un worktree sans vérifier qu'aucune session n'y travaille : ceux
  présents sous `.claude/worktrees/` et `/private/tmp/` peuvent être des agents actifs.
  `lab rm` refuse un worktree sale ou occupé.
