# Design — Routage d'entrée de l'atelier

## Objectif

Le routage (« qu'est-ce qu'on fait ? ») se décide **à l'entrée**, dans le launcher, au moment
où l'on choisit quoi faire. Une session déjà focalisée sur un projet démarre directement au
travail, sans re-poser les questions globales.

## Principe

Une décision, un seul endroit :

- **Le launcher décide** (quel projet, créer, lister, infra, plomberie, autre) et prépare le
  bon contexte avant de lancer `claude`.
- **Une session est déjà scoping** quand elle démarre : son accueil est centré sur son projet,
  pas sur le menu global.

## Le launcher — `lab` (sans argument) et `Atelier.command`

Routeur d'entrée complet. Chaque choix prépare le contexte puis lance `claude` :

| Choix | Action |
|---|---|
| **Bosser sur un projet** | liste les projets → choix + libellé → `lab new <projet> <libellé>` → worktree scoping + `claude` |
| **Créer un projet** | demande le nom → worktree bootstrap `work/new-<nom>` → `claude` avec l'intention `/lab-new <nom>` |
| **Plomberie de l'atelier** | meta (CLAUDE.md, skills, `lab`, hooks) → worktree `chore/atelier-<libellé>` → `claude` |
| **Lister les projets** | `claude` (checkout principal) avec `/lab-list` |
| **Infra / plateforme** | `claude` (checkout principal) avec l'intention infra |
| **Autre** | `claude` (checkout principal), prompt libre |

Les choix qui produisent des commits (projet, créer, plomberie) passent par un **worktree
isolé** ; ceux en lecture/diagnostic (lister, infra, autre) lancent `claude` dans le checkout
principal (zone exemptée par le garde-fou).

## Le hook SessionStart — scope-aware

Le hook détecte le contexte (branche, worktree, cwd) et injecte l'accueil adapté :

- **Session scoping** — worktree lié dont la branche est `work/<projet>-…` (avec `<projet>` =
  un dossier projet existant) : accueil projet, **aucun menu** :
  > « Session sur **<projet>** (branche `work/<projet>-…`). Lis `<projet>/CLAUDE.md`, travaille
  > dans `<projet>/`. On continue ? »
- **Checkout principal** (non scoping) : message léger, **pas le menu 5-options** :
  > « Tu es à la base de l'atelier. Lance `lab` (ou `Atelier.command`) pour choisir quoi faire,
  > ou `/start` si tu préfères router ici. »
- **Worktree de plomberie** (`chore/atelier-…`) : accueil meta : « Session plomberie de
  l'atelier. »

## Détection de scope (hook)

```
worktree lié ?  git rev-parse --absolute-git-dir != --git-common-dir (hors sous-module)
branche        = git rev-parse --abbrev-ref HEAD
projet         = pour chaque dossier P à Dockerfile : si branche == work/P ou commence par work/P-
meta           = branche commence par chore/atelier-
```

## `/start`

Routeur **de secours dans `claude`** : utilisé quand on ouvre `claude` brut dans le checkout
principal (ou via le choix « autre »/« infra » du launcher). Il porte les mêmes options que le
launcher. Il n'est plus déclenché dans les sessions scoping.

## Surface à construire

- `bin/lab` : `cmd_menu` devient le routeur complet (6 choix ci-dessus), incluant le bootstrap
  worktree pour « créer un projet » et « plomberie ».
- `.claude/hooks/session-start.sh` : détection de scope → accueil adapté.
- `.claude/skills/start/SKILL.md` : recadré en routeur de secours (mêmes options).
- `CLAUDE.md` : mettre à jour le démarrage (« lance `lab` ») et la liste des skills.

## Hors scope

- Routage des sessions **cloud** (`claude --remote`) : le scope vient du prompt de lancement,
  pas de la branche ; l'accueil y reste générique. Non traité ici.
