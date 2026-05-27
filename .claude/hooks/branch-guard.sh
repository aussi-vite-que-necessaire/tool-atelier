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
