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
MAIN="$(cd "$MAIN" && pwd -P)"   # chemin physique (macOS : /var → /private/var)
( cd "$MAIN"; git config user.email t@t; git config user.name t; git branch -M main
  mkdir hello; echo "FROM scratch" > hello/Dockerfile; echo x > CLAUDE.md
  git add -A; git commit -qm init; git branch feat )
WT="$TMP/wt"; git -C "$MAIN" worktree add -q "$WT" feat
WT="$(cd "$WT" && pwd -P)"

# guard <tool> <cwd> <command> <file_path> -> imprime le code de sortie du hook
guard() {
  printf '{"tool_name":"%s","cwd":"%s","tool_input":{"command":"%s","file_path":"%s"}}' \
    "$1" "$2" "$3" "$4" | "$HOOK"
  echo $?
}

# 1) commit sur main (checkout principal) => bloqué
[ "$(guard Bash "$MAIN" "git commit -m x" "")" = "2" ]            || fail "commit sur main non bloqué"
# 2) git switch -c dans le checkout principal => bloqué
[ "$(guard Bash "$MAIN" "git switch -c foo" "")" = "2" ]          || fail "switch dans checkout principal non bloqué"
# 3) Write dans un dossier projet depuis le checkout principal => bloqué
[ "$(guard Write "$MAIN" "" "$MAIN/hello/x.ts")" = "2" ]          || fail "write projet dans checkout principal non bloqué"
# 4) Write d'un méta (CLAUDE.md) depuis le checkout principal => autorisé
[ "$(guard Write "$MAIN" "" "$MAIN/CLAUDE.md")" = "0" ]           || fail "write méta bloqué à tort"
# 5) git switch dans un worktree lié => autorisé
[ "$(guard Bash "$WT" "git switch -c bar" "")" = "0" ]            || fail "switch en worktree bloqué à tort"
# 6) Write projet dans un worktree lié => autorisé
[ "$(guard Write "$WT" "" "$WT/hello/x.ts")" = "0" ]              || fail "write projet en worktree bloqué à tort"
# 7) git worktree add depuis le checkout principal => autorisé
[ "$(guard Bash "$MAIN" "git worktree add z" "")" = "0" ]         || fail "git worktree add bloqué à tort"

echo "OK guard.test.sh"
