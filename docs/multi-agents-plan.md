# Collaboration multi-agents — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'atelier un lanceur local de sessions isolées (`lab`), un garde-fou qui empêche le dev projet dans le checkout principal partagé, et la documentation du modèle « construire en cloud / opérer en local ».

**Architecture:** Tout vit dans l'atelier, agnostique au framework : un script shell `bin/lab` (pur git, relocalisable) crée un worktree + branche par session sous `.claude/worktrees/` ; le hook `branch-guard.sh` (PreToolUse) bloque les mutations de projet dans le checkout principal ; `CLAUDE.md` porte le contrat. Aucune nouvelle dépendance, aucun framework de test ajouté (tests = bash + repo temporaire).

**Tech Stack:** Bash, git worktree, jq (déjà utilisé par les hooks), hooks Claude Code (`PreToolUse`), settings.json.

**Contexte d'exécution :** ce plan s'exécute dans un worktree isolé (créé via `superpowers:using-git-worktrees`). Le hook étant actif dans le *checkout principal* uniquement, l'exécution en worktree n'est jamais bloquée par lui.

**⚠️ Rollout :** la modif de `.claude/settings.json` (Task 5) active le garde-fou dans le checkout principal pour **toutes** les sessions qui le lisent. Ne merger vers `main` que lorsque aucune session n'est en plein dev dans le checkout principal (sinon elle sera renvoyée vers un worktree — ce qui est le but, mais à faire en conscience).

---

## File Structure

- `bin/lab` (créer) — lanceur : sous-commandes `new` / `ls` / `cd` / `rm` / `menu`. Responsable de la création/listage/retrait des worktrees. Pur git, self-locating.
- `bin/lab-shell.sh` (créer) — fonction shell `lab()` à sourcer : wrappe `bin/lab` et fait le `cd` dans le terminal pour `new`/`cd`.
- `Atelier.command` (créer, racine) — point d'entrée double-cliquable macOS → `bin/lab menu`.
- `.claude/hooks/branch-guard.sh` (modifier) — devient le garde-fou complet (commit/push sur main + dev projet dans le checkout principal).
- `.claude/settings.json` (modifier) — matcher du hook étendu à `Bash|Write|Edit`.
- `.gitignore` (modifier) — ajoute `.claude/worktrees/`.
- `CLAUDE.md` (modifier) — section « Collaboration multi-agents ».
- `scripts/cloud-setup.sh` (créer) — installe les deps de chaque projet Node (pour l'environnement cloud monorepo).
- `test/lab.test.sh`, `test/guard.test.sh` (créer) — tests bash dépendance-zéro sur repo temporaire.

---

## Task 1: Ignorer `.claude/worktrees/`

Corrige la pollution actuelle (`?? .claude/worktrees/` dans `git status`) et garantit que les copies de worktree ne sont jamais committées.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ajouter l'entrée**

Ajouter à la fin de `.gitignore` :

```
.claude/worktrees/
```

- [ ] **Step 2: Vérifier que c'est pris en compte**

Run: `git check-ignore -v .claude/worktrees/`
Expected: une ligne pointant vers `.gitignore:<n>:.claude/worktrees/`

Run: `git status --short | grep -F '.claude/worktrees/' || echo CLEAN`
Expected: `CLEAN` (le dossier n'apparaît plus comme non suivi)

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "🔧 git : ignorer .claude/worktrees/ (copies de worktree hors versionnement)"
```

---

## Task 2: `bin/lab new` — créer une session isolée

**Files:**
- Create: `bin/lab`
- Test: `test/lab.test.sh`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/lab.test.sh` :

```bash
#!/usr/bin/env bash
# Test dépendance-zéro de bin/lab sur un repo git temporaire.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
git init -q; git config user.email t@t; git config user.name t; git branch -M main
mkdir -p bin hello; echo "FROM scratch" > hello/Dockerfile
cp "$ATELIER/bin/lab" bin/lab; chmod +x bin/lab
git add -A; git commit -qm init

# new crée la branche + le worktree, et imprime le chemin
out="$(bin/lab new hello "Preview LinkedIn")" || fail "new a échoué"
[ -d ".claude/worktrees/hello-preview-linkedin" ] || fail "worktree absent"
git show-ref --verify --quiet refs/heads/work/hello-preview-linkedin || fail "branche absente"
[ "$out" = "$TMP/.claude/worktrees/hello-preview-linkedin" ] || fail "chemin imprimé inattendu: $out"

# projet inconnu => échec
bin/lab new nope x 2>/dev/null && fail "projet inconnu accepté"

# doublon => échec
bin/lab new hello "Preview LinkedIn" 2>/dev/null && fail "doublon accepté"

echo "OK lab.test.sh"
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bash test/lab.test.sh`
Expected: FAIL (le fichier `bin/lab` n'existe pas encore → `cp` échoue)

- [ ] **Step 3: Écrire le minimum dans `bin/lab`**

Créer `bin/lab` (les sous-commandes `ls`/`cd`/`rm`/`menu` arrivent en Task 3-4 ; on pose le squelette + `new`) :

```bash
#!/usr/bin/env bash
# lab — lanceur de l'atelier : une session = un worktree isolé + une branche.
# Relocalisable : se situe via son propre chemin. Pur git, sans dépendance.
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd -P)"
ROOT="$(cd "$SELF/.." && (git rev-parse --show-toplevel 2>/dev/null || pwd -P))"
WT_DIR="$ROOT/.claude/worktrees"

usage() {
  cat >&2 <<'EOF'
lab — sessions isolées de l'atelier
  lab new <projet> [libellé]   crée work/<projet>-<libellé> + worktree, imprime le chemin
  lab ls                       liste les worktrees et leur branche
  lab cd <nom>                 imprime le chemin d'un worktree (via la fonction shell)
  lab rm <nom>                 retire un worktree (refuse si non propre)
EOF
  exit 2
}

slug() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//'; }

cmd_new() {
  local proj="${1:-}" label="${2:-session}"
  [ -n "$proj" ] || usage
  { [ -d "$ROOT/$proj" ] && [ -f "$ROOT/$proj/Dockerfile" ]; } \
    || { echo "lab: projet inconnu: $proj" >&2; exit 1; }
  local name; name="$(slug "$proj")-$(slug "$label")"
  local branch="work/$name" path="$WT_DIR/$name"
  [ -e "$path" ] && { echo "lab: worktree déjà présent: $path" >&2; exit 1; }
  git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch" \
    && { echo "lab: branche déjà prise: $branch" >&2; exit 1; }
  git -C "$ROOT" worktree add -q -b "$branch" "$path" >/dev/null
  echo "session prête : $proj sur $branch" >&2
  echo "$path"
}

sub="${1:-menu}"; shift 2>/dev/null || true
case "$sub" in
  new) cmd_new "$@" ;;
  *)   usage ;;
esac
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `chmod +x bin/lab && bash test/lab.test.sh`
Expected: `OK lab.test.sh`

- [ ] **Step 5: Commit**

```bash
git add bin/lab test/lab.test.sh
git commit -m "✨ lab : 'lab new' crée une session isolée (worktree + branche)"
```

---

## Task 3: `bin/lab ls` / `cd` / `rm`

**Files:**
- Modify: `bin/lab`
- Modify: `test/lab.test.sh`

- [ ] **Step 1: Étendre le test (échoue)**

Ajouter dans `test/lab.test.sh`, juste avant la ligne `echo "OK lab.test.sh"` :

```bash
# ls liste le worktree créé
bin/lab ls | grep -q "hello-preview-linkedin" || fail "ls n'affiche pas le worktree"

# cd imprime le chemin
[ "$(bin/lab cd hello-preview-linkedin)" = "$TMP/.claude/worktrees/hello-preview-linkedin" ] \
  || fail "cd n'imprime pas le bon chemin"
bin/lab cd inexistant 2>/dev/null && fail "cd sur worktree inexistant accepté"

# rm refuse si le worktree est sale
echo brouillon > .claude/worktrees/hello-preview-linkedin/sale.txt
bin/lab rm hello-preview-linkedin 2>/dev/null && fail "rm a accepté un worktree sale"
rm .claude/worktrees/hello-preview-linkedin/sale.txt

# rm retire un worktree propre (la branche reste)
bin/lab rm hello-preview-linkedin || fail "rm a échoué sur worktree propre"
[ -d ".claude/worktrees/hello-preview-linkedin" ] && fail "worktree non retiré"
git show-ref --verify --quiet refs/heads/work/hello-preview-linkedin || fail "branche supprimée à tort"
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bash test/lab.test.sh`
Expected: FAIL sur `ls n'affiche pas le worktree` (sous-commandes absentes → `usage`)

- [ ] **Step 3: Implémenter `ls`/`cd`/`rm`**

Dans `bin/lab`, ajouter ces fonctions avant le bloc `case` final :

```bash
cmd_ls() {
  local d n b s
  for d in "$WT_DIR"/*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d")"
    b="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    if [ -n "$(git -C "$d" status --porcelain 2>/dev/null)" ]; then s="sale"; else s="propre"; fi
    printf '%-32s %-32s %s\n' "$n" "$b" "$s"
  done
}

cmd_cd() {
  local name="${1:-}"; [ -n "$name" ] || usage
  local path="$WT_DIR/$name"
  [ -d "$path" ] || { echo "lab: worktree introuvable: $name" >&2; exit 1; }
  echo "$path"
}

cmd_rm() {
  local name="${1:-}"; [ -n "$name" ] || usage
  local path="$WT_DIR/$name"
  [ -d "$path" ] || { echo "lab: worktree introuvable: $name" >&2; exit 1; }
  [ -n "$(git -C "$path" status --porcelain 2>/dev/null)" ] \
    && { echo "lab: refus — worktree non propre (travail en cours): $name" >&2; exit 1; }
  git -C "$ROOT" worktree remove "$path"
  echo "retiré: $name (branche conservée ; après merge : git branch -d work/$name)" >&2
}
```

Et compléter le `case` final :

```bash
case "$sub" in
  new) cmd_new "$@" ;;
  ls)  cmd_ls ;;
  cd)  cmd_cd "$@" ;;
  rm)  cmd_rm "$@" ;;
  *)   usage ;;
esac
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `bash test/lab.test.sh`
Expected: `OK lab.test.sh`

- [ ] **Step 5: Commit**

```bash
git add bin/lab test/lab.test.sh
git commit -m "✨ lab : sous-commandes ls / cd / rm (rm refuse un worktree sale)"
```

---

## Task 4: Fonction shell + lanceur double-clic

`bin/lab` ne peut pas `cd` le terminal parent : une fonction shell sourcée le fait. Le menu interactif et le double-clic, eux, tournent dans le processus du terminal et peuvent `cd` + `exec claude`.

**Files:**
- Create: `bin/lab-shell.sh`
- Modify: `bin/lab` (ajout sous-commande `menu`)
- Create: `Atelier.command`

- [ ] **Step 1: Ajouter `cmd_menu` à `bin/lab`**

Dans `bin/lab`, ajouter la fonction (avant le `case`) :

```bash
cmd_menu() {
  local projects=() d
  for d in "$ROOT"/*/; do [ -f "$d/Dockerfile" ] && projects+=("$(basename "$d")"); done
  [ "${#projects[@]}" -gt 0 ] || { echo "aucun projet dans l'atelier" >&2; exit 1; }
  echo "Projets de l'atelier :" >&2
  local i=1 p
  for p in "${projects[@]}"; do printf '  %d) %s\n' "$i" "$p" >&2; i=$((i+1)); done
  printf 'Projet (numéro) ? ' >&2; read -r choice
  local proj="${projects[$((choice-1))]:-}"
  [ -n "$proj" ] || { echo "choix invalide" >&2; exit 1; }
  printf 'Libellé (ex: apercu-linkedin) ? ' >&2; read -r label
  local path; path="$(cmd_new "$proj" "${label:-session}")"
  cd "$path" && exec claude
}
```

Et ajouter `menu) cmd_menu ;;` dans le `case` final.

- [ ] **Step 2: Créer la fonction shell `bin/lab-shell.sh`**

```bash
# Source-moi depuis ton shell : source <repo>/bin/lab-shell.sh
# Fournit la commande `lab` qui, pour `new`/`cd`, dépose ton terminal dans le worktree.
_lab_self="${BASH_SOURCE[0]:-${(%):-%x}}"
LAB_BIN="$(cd "$(dirname "$_lab_self")" && pwd -P)/lab"

lab() {
  case "${1:-}" in
    new|cd)
      local out path
      out="$("$LAB_BIN" "$@")" || { printf '%s\n' "$out" >&2; return 1; }
      path="$(printf '%s\n' "$out" | tail -1)"
      if [ -d "$path" ]; then
        cd "$path" || return 1
        echo "→ $(pwd) ($(git rev-parse --abbrev-ref HEAD)). Lance: claude"
      else
        printf '%s\n' "$out"
      fi
      ;;
    *) "$LAB_BIN" "$@" ;;
  esac
}
```

- [ ] **Step 3: Créer le lanceur double-clic `Atelier.command`**

```bash
#!/usr/bin/env bash
# Double-cliquable (macOS) : ouvre le menu de l'atelier dans ce terminal.
cd "$(dirname "$0")" || exit 1
exec ./bin/lab menu
```

- [ ] **Step 4: Rendre exécutables et vérifier le non-régression**

```bash
chmod +x bin/lab Atelier.command
bash test/lab.test.sh
```
Expected: `OK lab.test.sh` (les ajouts ne cassent pas `new`/`ls`/`cd`/`rm`)

- [ ] **Step 5: Vérification manuelle (interactif, hors test auto)**

Run: `source bin/lab-shell.sh && lab ls`
Expected: liste (vide ou non) sans erreur.
Note : le `lab new`/double-clic se vérifient à la main en lançant une vraie session ; ils ne sont pas dans le test auto (interactif + lance `claude`).

- [ ] **Step 6: Commit**

```bash
git add bin/lab bin/lab-shell.sh Atelier.command
git commit -m "✨ lab : fonction shell (cd dans le worktree) + menu double-cliquable Atelier.command"
```

---

## Task 5: Garde-fou — pas de dev projet dans le checkout principal

On étend `branch-guard.sh` : il garde le blocage commit/push sur `main`, et ajoute — **dans le checkout principal partagé uniquement** — le refus de `git switch`/`git checkout` de branche et de l'édition d'un dossier projet. Dans un worktree lié, tout passe.

**Files:**
- Modify: `.claude/hooks/branch-guard.sh`
- Modify: `.claude/settings.json`
- Test: `test/guard.test.sh`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/guard.test.sh` :

```bash
#!/usr/bin/env bash
# Test du garde-fou : checkout principal vs worktree lié.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK="$ATELIER/.claude/hooks/branch-guard.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP guard.test.sh (jq absent)"; exit 0; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
MAIN="$TMP/main"
git init -q "$MAIN"
( cd "$MAIN"; git config user.email t@t; git config user.name t; git branch -M main
  mkdir hello; echo "FROM scratch" > hello/Dockerfile; echo x > CLAUDE.md
  git add -A; git commit -qm init; git branch feat )
WT="$TMP/wt"; git -C "$MAIN" worktree add -q "$WT" feat

guard() { printf '%s' "$1" | "$HOOK"; echo $?; }

# 1) commit sur main (checkout principal) => bloqué
[ "$(guard "{\"tool_name\":\"Bash\",\"cwd\":\"$MAIN\",\"tool_input\":{\"command\":\"git commit -m x\"}}")" = "2" ] \
  || fail "commit sur main non bloqué"
# 2) git switch -c dans le checkout principal => bloqué
[ "$(guard "{\"tool_name\":\"Bash\",\"cwd\":\"$MAIN\",\"tool_input\":{\"command\":\"git switch -c foo\"}}")" = "2" ] \
  || fail "switch dans checkout principal non bloqué"
# 3) Write dans un dossier projet depuis le checkout principal => bloqué
[ "$(guard "{\"tool_name\":\"Write\",\"cwd\":\"$MAIN\",\"tool_input\":{\"file_path\":\"$MAIN/hello/x.ts\"}}")" = "2" ] \
  || fail "write projet dans checkout principal non bloqué"
# 4) Write d'un méta (CLAUDE.md) depuis le checkout principal => autorisé
[ "$(guard "{\"tool_name\":\"Write\",\"cwd\":\"$MAIN\",\"tool_input\":{\"file_path\":\"$MAIN/CLAUDE.md\"}}")" = "0" ] \
  || fail "write méta bloqué à tort"
# 5) git switch dans un worktree lié => autorisé
[ "$(guard "{\"tool_name\":\"Bash\",\"cwd\":\"$WT\",\"tool_input\":{\"command\":\"git switch -c bar\"}}")" = "0" ] \
  || fail "switch en worktree bloqué à tort"
# 6) Write projet dans un worktree lié => autorisé
[ "$(guard "{\"tool_name\":\"Write\",\"cwd\":\"$WT\",\"tool_input\":{\"file_path\":\"$WT/hello/x.ts\"}}")" = "0" ] \
  || fail "write projet en worktree bloqué à tort"
# 7) git worktree add depuis le checkout principal => autorisé
[ "$(guard "{\"tool_name\":\"Bash\",\"cwd\":\"$MAIN\",\"tool_input\":{\"command\":\"git worktree add z\"}}")" = "0" ] \
  || fail "git worktree add bloqué à tort"

echo "OK guard.test.sh"
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `bash test/guard.test.sh`
Expected: FAIL sur le cas 2 (le hook actuel ne bloque pas `git switch` dans le checkout principal)

- [ ] **Step 3: Réécrire `.claude/hooks/branch-guard.sh`**

Remplacer tout le contenu par :

```bash
#!/usr/bin/env bash
# Hook PreToolUse — garde-fou de collaboration multi-agents.
#   1. Jamais de commit/push quand la branche courante est main/master (tout checkout).
#   2. Dans le CHECKOUT PRINCIPAL partagé (pas un worktree lié) :
#      - refus de git switch / git checkout <branche> (le footgun qui détourne la branche
#        partagée) ;
#      - refus d'éditer un fichier d'un dossier projet (dir top-level avec Dockerfile)
#        → force le dev en worktree (lab new <projet> <libellé>).
# Lit le JSON du hook sur stdin. Fail-open si jq/git absents ou hors repo.
set -uo pipefail

json="$(cat)"
command -v jq  >/dev/null 2>&1 || exit 0
command -v git >/dev/null 2>&1 || exit 0

tool="$(printf '%s' "$json" | jq -r '.tool_name // ""')"
cwd="$(printf '%s' "$json"  | jq -r '.cwd // "."')"
cmd="$(printf '%s' "$json"  | jq -r '.tool_input.command // ""')"
file="$(printf '%s' "$json" | jq -r '.tool_input.file_path // ""')"

cd "$cwd" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# 1) Jamais de commit/push sur main/master
case "$cmd" in
  *"git commit"*|*"git push"*)
    if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
      printf 'Bloqué : jamais de commit/push sur "%s" dans l'\''atelier. Crée une branche (lab new <projet> <libellé>) puis ouvre une PR.\n' "$branch" >&2
      exit 2
    fi ;;
esac

# Suis-je dans le checkout principal partagé (pas un worktree lié, pas un sous-module) ?
gd="$(git rev-parse --absolute-git-dir 2>/dev/null)"
gcd="$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd -P)"
super="$(git rev-parse --show-superproject-working-tree 2>/dev/null)"
[ -n "$gd" ] && [ "$gd" = "$gcd" ] && [ -z "$super" ] || exit 0   # worktree lié → tout permis

root="$(git rev-parse --show-toplevel 2>/dev/null)"

# 2) Pas de changement de branche dans le checkout principal
case "$cmd" in
  *"git checkout -- "*|*"git checkout --") : ;;          # restore de fichiers → OK
  *"git switch"*|*"git checkout "*)
    printf 'Bloqué : pas de changement de branche dans le checkout principal partagé (d'\''autres sessions le partagent). Crée ton worktree : lab new <projet> <libellé>.\n' >&2
    exit 2 ;;
esac

# 3) Pas d'édition d'un dossier projet dans le checkout principal
if { [ "$tool" = "Write" ] || [ "$tool" = "Edit" ]; } && [ -n "$file" ] && [ -n "$root" ]; then
  rel="${file#"$root"/}"
  top="${rel%%/*}"
  if [ "$top" != "$rel" ] && [ -f "$root/$top/Dockerfile" ]; then
    printf 'Bloqué : pas de dev projet (%s/) dans le checkout principal partagé. Lance ta session en worktree : lab new %s <libellé>.\n' "$top" "$top" >&2
    exit 2
  fi
fi

exit 0
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `chmod +x .claude/hooks/branch-guard.sh && bash test/guard.test.sh`
Expected: `OK guard.test.sh`

- [ ] **Step 5: Étendre le matcher du hook**

Dans `.claude/settings.json`, remplacer `"matcher": "Bash"` (celui du bloc `PreToolUse` qui appelle `branch-guard.sh`) par :

```json
"matcher": "Bash|Write|Edit",
```

- [ ] **Step 6: Vérifier la validité du JSON**

Run: `jq . .claude/settings.json >/dev/null && echo VALID`
Expected: `VALID`

- [ ] **Step 7: Commit**

```bash
git add .claude/hooks/branch-guard.sh .claude/settings.json test/guard.test.sh
git commit -m "✨ garde-fou : bloque le dev projet et le changement de branche dans le checkout principal"
```

---

## Task 6: Documenter le contrat dans `CLAUDE.md`

État cible : `CLAUDE.md` décrit le modèle de collaboration comme s'il avait toujours été là.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Remplacer le 4e point de « Workflow & isolation »**

Dans la section « Workflow & isolation — RÈGLE ABSOLUE », remplacer la puce :

> - Plusieurs agents en parallèle : chaque session d'arrière-plan a son **worktree isolé** + sa branche → aucun conflit. Un hook `branch-guard` rappelle/bloque les commits sur main (en CLI).

par :

```markdown
- **Une session = un worktree isolé + une branche.** Voir « Collaboration multi-agents ». Le hook `branch-guard` bloque les commits/push sur `main` et le dev projet dans le checkout principal partagé.
```

- [ ] **Step 2: Ajouter la section « Collaboration multi-agents »**

Insérer après la section « Workflow & isolation — RÈGLE ABSOLUE » :

```markdown
## Collaboration multi-agents

**Étoile polaire : deux agents ne touchent jamais la même ressource mutable au même instant.** Le code et la branche s'isolent ; la prod (singleton) se sérialise.

- **Construire = cloud.** Chaque tâche autonome tourne en session cloud (isolée, sa branche, sa preview, sa PR). Le deploy est CI-piloté (`git push`), donc une session cloud n'a pas besoin de SSH. On n'y met ni la clé SSH du lab ni `LAB_SECRETS_KEY`.
- **Opérer = local de confiance.** Logs, diagnostic (`/lab-ssh`), secrets (`/lab-secret`), dev hands-on : sur ta machine, qui détient les clés.
- **Sessions locales isolées.** Une session = un worktree sous `.claude/worktrees/` + sa branche `work/<projet>-<libellé>`. Lance-les avec **`lab new <projet> <libellé>`** (ou le menu double-clic `Atelier.command`). Jamais deux sessions d'écriture dans le checkout principal : il sert de base de lancement et pour la plomberie de l'atelier (CLAUDE.md, skills, scripts), pas pour le dev projet.
- **Prod sérialisée.** La prod ne change que par l'entonnoir PR → merge → CI (un seul déploiement à la fois). Pas de mutation de prod en SSH ad-hoc ; la lecture/diagnostic SSH reste libre.
- **Frameworks invités.** superpowers et consorts accélèrent mais défèrent à ce contrat : leurs skills de worktree utilisent `lab`, leur « fin de branche » défère à `/lab-deploy` + PR.
```

- [ ] **Step 3: Vérifier la cohérence**

Run: `grep -c "Collaboration multi-agents" CLAUDE.md`
Expected: `1`

Relire la section : aucun cadrage par contraste (« désormais », « au lieu de »), uniquement l'état cible.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "📝 atelier : contrat de collaboration multi-agents (cloud build / local operate / lab)"
```

---

## Task 7: Setup cloud monorepo

Fournit un script d'installation des dépendances pour l'environnement cloud (qui clone tout le monorepo), et documente l'amorçage cloud.

**Files:**
- Create: `scripts/cloud-setup.sh`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Créer `scripts/cloud-setup.sh`**

```bash
#!/usr/bin/env bash
# cloud-setup.sh — prépare l'environnement cloud (monorepo) : installe les deps de
# chaque projet Node. Idempotent. À pointer depuis la config de l'environnement cloud.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
for dir in "$ROOT"/*/; do
  [ -f "$dir/package.json" ] || continue
  echo "→ deps: $(basename "$dir")"
  ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } )
done
echo "cloud-setup terminé"
```

- [ ] **Step 2: Vérifier que le script est syntaxiquement sain (dry-run lint)**

Run: `bash -n scripts/cloud-setup.sh && echo OK-SYNTAX`
Expected: `OK-SYNTAX`

(L'exécution réelle suppose Node et du réseau ; elle se valide dans l'environnement cloud, pas ici.)

- [ ] **Step 3: Documenter l'amorçage cloud dans `CLAUDE.md`**

Ajouter, à la fin de la section « Collaboration multi-agents », la puce :

```markdown
- **Amorçage cloud.** Une fois : connecter GitHub (`/web-setup`). L'environnement cloud lance `scripts/cloud-setup.sh` au démarrage (installe les deps par projet). Les secrets cloud sont des variables d'environnement (visibles) : on n'y met que ce qu'une session de build doit voir.
```

- [ ] **Step 4: Rendre exécutable et commit**

```bash
chmod +x scripts/cloud-setup.sh
git add scripts/cloud-setup.sh CLAUDE.md
git commit -m "✨ cloud : script de setup monorepo + amorçage documenté"
```

---

## Self-Review

**Spec coverage :**
- Étoile polaire → Task 6. ✓
- Construire cloud / opérer local → Task 6, Task 7. ✓
- Isolation entre agents (worktree local) → Task 2-4. ✓
- Lanceur `lab` (new/ls/cd/rm, double-clic, relocalisable, fonction shell) → Task 2-4. ✓
- Garde-fou hook + zone d'exemption → Task 5. ✓
- `.gitignore` `.claude/worktrees/` → Task 1. ✓
- Coordination infra (preview/prod/ssh) → Task 6 (doc ; le `concurrency` group existe déjà côté CI). ✓
- Cohabitation frameworks invités → Task 6 (doc). ✓
- Setup cloud monorepo → Task 7. ✓
- `cartography.sh` : pas de tâche — le glob `"$REPO_ROOT"/*/` ignore déjà `.claude/` (caché). Vérifié.

**Placeholders :** aucun TBD/TODO ; tout le code des scripts et des tests est fourni en entier.

**Cohérence des noms :** `lab new|ls|cd|rm|menu`, `slug()`, `cmd_new/ls/cd/rm/menu`, `WT_DIR`, `ROOT`, `LAB_BIN`, branches `work/<slug-projet>-<slug-libellé>`, worktrees `.claude/worktrees/<nom>` — identiques entre Task 2, 3, 4 et le test. Le hook `branch-guard.sh` est référencé par le même chemin en Task 5 et dans `settings.json`.
