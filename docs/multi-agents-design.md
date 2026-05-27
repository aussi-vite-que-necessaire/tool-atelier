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
  nativement (`claude --worktree` ; sessions d'arrière-plan / vue agents, chacune dans son
  worktree). Le lanceur de l'atelier choisit local/cloud et défère au worktree natif ; le
  garde-fou protège le checkout principal.
- **Règle dure** : jamais deux sessions d'écriture dans le **checkout principal**. Le
  checkout principal est une **base** d'où l'on lance des sessions et d'où l'on touche la
  plomberie de l'atelier (CLAUDE.md, skills, scripts) — jamais un lieu de dev de projet.

## Le lanceur — `Atelier.command`

Un point d'entrée unique, **double-cliquable** (`Atelier.command` à la racine) et
**relocalisable** (se localise via son propre chemin ; survit à un déplacement du dossier).
Il ne fait qu'une chose : **sandboxer le dev**. Il pose une seule question — **local ou
cloud** — et ouvre la session isolée correspondante :

| Mode | Effet |
|---|---|
| `local` | `claude --worktree` — worktree isolé natif sous `.claude/worktrees/`, branche auto-nommée, auto-nettoyé s'il n'a rien produit |
| `cloud` | session sur claude.ai (`claude --remote "<amorçage>"` si le CLI le supporte, sinon ouvre `claude.ai/code`), pilotée au navigateur/mobile |

Le lanceur ne décide d'aucune tâche : tout le « quoi faire » se décide dans la session via
`/start`. Pour le cloud, l'amorçage ne fait que déclencher `/start` (aucune tâche pré-choisie).

L'isolation worktree s'appuie entièrement sur le worktree natif de Claude Code (`claude
--worktree`), sans plomberie maison. Worktrees sous `.claude/worktrees/<nom>/`, dans
`.gitignore` : les copies du monorepo ne polluent ni `git status` ni les commits ; le reste
de `.claude/` reste versionné. La gestion des worktrees restants se fait avec git natif
(`git worktree list` / `git worktree remove`). `scripts/cartography.sh` exclut
`.claude/worktrees/`.

## Le garde-fou — hook

Un hook `PreToolUse` (sur `Write`, `Edit`, `Bash`) détecte le checkout principal partagé :

```
git rev-parse --git-dir  ==  git rev-parse --git-common-dir   → checkout principal
                         ≠                                     → worktree lié (OK)
```

Dans le checkout principal, il **refuse** de muter du code projet, `git switch`,
`git commit`/`git add` de code projet, avec le message « lance d'abord ta session isolée :
`Atelier.command` (ou `claude --worktree`) ». Zone d'exemption : lecture, `lab-*`, et
l'édition des métas de l'atelier (`CLAUDE.md`, `.claude/`, `docs/`, `bin/`, `scripts/`).
C'est l'extension du
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
- `Atelier.command` : lanceur double-cliquable et relocalisable, une seule question
  (local/cloud), appuyé sur le worktree natif de Claude Code (`claude --worktree` /
  `claude --remote`).
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
  `claude --worktree` ne nettoie automatiquement que les worktrees sans changement.
