#!/usr/bin/env bash
# Vérifie l'accueil SessionStart selon le scope.
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
HOOK="$ATELIER/.claude/hooks/session-start.sh"
command -v jq >/dev/null 2>&1 || { echo "SKIP session-start.test.sh (jq absent)"; exit 0; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
MAIN="$TMP/main"; git init -q "$MAIN"; MAIN="$(cd "$MAIN" && pwd -P)"
( cd "$MAIN"; git config user.email t@t; git config user.name t; git branch -M main
  mkdir hello; echo "FROM scratch" > hello/Dockerfile; git add -A; git commit -qm init
  git branch work/hello-essai; git branch chore/atelier-x )
HW="$TMP/hw"; git -C "$MAIN" worktree add -q "$HW" work/hello-essai
MW="$TMP/mw"; git -C "$MAIN" worktree add -q "$MW" chore/atelier-x

run() { ( cd "$1" && "$HOOK" ); }   # le hook lit son cwd

run "$MAIN" | grep -q "checkout principal" || fail "checkout principal non détecté"
run "$HW"   | grep -q "hello"              || fail "scope projet hello non détecté"
run "$MW"   | grep -q "plomberie"          || fail "scope plomberie non détecté"

echo "OK session-start.test.sh"
