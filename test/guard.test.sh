#!/usr/bin/env bash
# Tests du hook branch-guard.sh — modèle cloud (1 session = 1 conteneur = 1 branche).
# Seul invariant : jamais de commit/push qui met main/master à jour.
# Lance: bash test/guard.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK="$ATELIER/.claude/hooks/branch-guard.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP guard.test.sh (jq absent)"; exit 0; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"
git init -q "$REPO"
REPO="$(cd "$REPO" && pwd -P)"   # chemin physique (macOS : /var → /private/var)
( cd "$REPO"; git config user.email t@t; git config user.name t; git branch -M main
  mkdir hello; echo "FROM scratch" > hello/Dockerfile; echo x > CLAUDE.md
  git add -A; git commit -qm init )

# guard <tool> <cwd> <command> <file_path> -> imprime le code de sortie du hook
guard() {
  printf '{"tool_name":"%s","cwd":"%s","tool_input":{"command":"%s","file_path":"%s"}}' \
    "$1" "$2" "$3" "$4" | "$HOOK"
  echo $?
}

# ── Sur main : seul invariant protégé ──
# 1) commit sur main => bloqué
[ "$(guard Bash "$REPO" "git commit -m x" "")" = "2" ]            || fail "commit sur main non bloqué"
# 2) push sur main => bloqué (force le flux PR)
[ "$(guard Bash "$REPO" "git push" "")" = "2" ]                   || fail "push sur main non bloqué"
# 3) suppression d'une branche distante depuis main => autorisée (nettoyage)
[ "$(guard Bash "$REPO" "git push --delete origin feat" "")" = "0" ] || fail "push --delete bloqué à tort"
# 4) suppression forme courte (-d) depuis main => autorisée
[ "$(guard Bash "$REPO" "git push -d origin feat" "")" = "0" ]    || fail "push -d bloqué à tort"
# 5) lecture (git status) sur main => autorisée
[ "$(guard Bash "$REPO" "git status" "")" = "0" ]                 || fail "git status bloqué à tort sur main"

# ── Sur une branche de session : tout permis (le conteneur est privé) ──
git -C "$REPO" switch -c work/x -q
# 6) commit sur branche de session => autorisé
[ "$(guard Bash "$REPO" "git commit -m x" "")" = "0" ]            || fail "commit sur branche de session bloqué à tort"
# 7) push sur branche de session => autorisé
[ "$(guard Bash "$REPO" "git push -u origin work/x" "")" = "0" ]  || fail "push sur branche de session bloqué à tort"
# 8) git switch sur branche de session => autorisé (plus de garde worktree)
[ "$(guard Bash "$REPO" "git switch main" "")" = "0" ]            || fail "git switch bloqué à tort"
# 9) édition d'un dossier projet sur branche de session => autorisée
[ "$(guard Edit "$REPO" "" "$REPO/hello/server.js")" = "0" ]      || fail "édition projet bloquée à tort"

echo "OK guard.test.sh"
