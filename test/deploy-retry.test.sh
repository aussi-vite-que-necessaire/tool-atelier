#!/usr/bin/env bash
# Tests de la fiabilisation du deploy lab : retry/backoff sur `docker pull` et verrou global
# `flock`. On SOURCE scripts/deploy.sh et scripts/teardown.sh (garde source-safe → ils ne
# déploient rien quand on les source) avec des stubs `docker`/`flock`/`sleep` sur le PATH, puis
# on exerce les fonctions en isolation. Calqué sur test/guard.test.sh.
# Lance: bash test/deploy-retry.test.sh
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY="$ATELIER/scripts/deploy.sh"
TEARDOWN="$ATELIER/scripts/teardown.sh"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
BIN="$TMP/bin"; mkdir -p "$BIN"
COUNT="$TMP/pull-count"
LOCKFILE="$TMP/deploy.lock"
export DOCKER_PULL_COUNT="$COUNT"

# Stub docker : seul `pull` est instrumenté (compte les tentatives ; échoue les
# DOCKER_PULL_FAIL_TIMES premières). Toute autre sous-commande réussit silencieusement.
cat > "$BIN/docker" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "pull" ]; then
  n=$(( $(cat "$DOCKER_PULL_COUNT" 2>/dev/null || echo 0) + 1 ))
  echo "$n" > "$DOCKER_PULL_COUNT"
  if [ "$n" -le "${DOCKER_PULL_FAIL_TIMES:-0}" ]; then echo "pull fail $n" >&2; exit 1; fi
fi
exit 0
EOF
# Stub sleep : no-op (tests instantanés, on ne dort jamais réellement).
printf '#!/usr/bin/env bash\nexit 0\n' > "$BIN/sleep"
# Stub flock : rend FLOCK_EXIT (défaut 0). Ignore ses arguments.
printf '#!/usr/bin/env bash\nexit "${FLOCK_EXIT:-0}"\n' > "$BIN/flock"
chmod +x "$BIN/docker" "$BIN/sleep" "$BIN/flock"

# Source un script avec les stubs en tête de PATH, dans un sous-shell isolé, puis exécute la
# commande passée. Le `set -e` éventuel du script reste confiné au sous-shell.
run_sourced() { local script="$1"; shift; ( PATH="$BIN:$PATH"; . "$script" >/dev/null 2>&1; "$@" ); }

reset() { echo 0 > "$COUNT"; }

# ── retry_pull ──
# 1) réussit après 2 échecs simulés (3e tentative OK), exactement 3 tentatives.
reset
DOCKER_PULL_FAIL_TIMES=2 PULL_MAX_ATTEMPTS=3 \
  run_sourced "$DEPLOY" retry_pull "ghcr.io/x:tag" >/dev/null 2>&1 \
  || fail "retry_pull devrait réussir après 2 échecs"
[ "$(cat "$COUNT")" = "3" ] || fail "retry_pull devrait avoir tenté 3 fois (got $(cat "$COUNT"))"

# 2) échoue (non-zéro) après PULL_MAX_ATTEMPTS tentatives épuisées.
reset
if DOCKER_PULL_FAIL_TIMES=9 PULL_MAX_ATTEMPTS=3 \
     run_sourced "$DEPLOY" retry_pull "ghcr.io/x:tag" >/dev/null 2>&1; then
  fail "retry_pull devrait échouer quand tous les essais échouent"
fi
[ "$(cat "$COUNT")" = "3" ] || fail "retry_pull devrait s'arrêter à 3 tentatives (got $(cat "$COUNT"))"

# ── acquire_deploy_lock ──
# 3) réussit quand flock rend 0.
FLOCK_EXIT=0 DEPLOY_LOCKFILE="$LOCKFILE" \
  run_sourced "$DEPLOY" acquire_deploy_lock >/dev/null 2>&1 \
  || fail "acquire_deploy_lock devrait réussir quand flock rend 0"

# 4) échoue (exit non-zéro) quand flock rend non-zéro (timeout).
if FLOCK_EXIT=1 DEPLOY_LOCKFILE="$LOCKFILE" DEPLOY_LOCK_TIMEOUT=1 \
     run_sourced "$DEPLOY" acquire_deploy_lock >/dev/null 2>&1; then
  fail "acquire_deploy_lock devrait échouer quand flock rend non-zéro"
fi

# 5) teardown.sh partage le même verrou (fonction présente et opérante).
FLOCK_EXIT=0 DEPLOY_LOCKFILE="$LOCKFILE" \
  run_sourced "$TEARDOWN" acquire_deploy_lock >/dev/null 2>&1 \
  || fail "teardown.sh devrait exposer acquire_deploy_lock (verrou partagé)"

# ── garde source-safe : sourcer ne déploie rien ──
reset
( PATH="$BIN:$PATH"; . "$DEPLOY" >/dev/null 2>&1; declare -F retry_pull >/dev/null ) \
  || fail "sourcer deploy.sh devrait définir retry_pull sans exécuter le deploy"
[ "$(cat "$COUNT")" = "0" ] || fail "sourcer deploy.sh ne devrait déclencher aucun docker pull"
( PATH="$BIN:$PATH"; . "$TEARDOWN" >/dev/null 2>&1; declare -F acquire_deploy_lock >/dev/null ) \
  || fail "sourcer teardown.sh devrait définir acquire_deploy_lock sans exécuter le teardown"

# ── shellcheck (si dispo) ──
if command -v shellcheck >/dev/null 2>&1; then
  # --severity=warning : on bloque sur warning/error, pas sur les `info` advisory (SC2015/SC1091
  # préexistants = idiomes volontaires et sources d'un .env qui n'existe que sur le lab).
  shellcheck --severity=warning -x "$DEPLOY" "$TEARDOWN" || fail "shellcheck sur deploy.sh/teardown.sh"
else
  echo "ℹ shellcheck absent — skip lint"
fi

echo "PASS: deploy-retry.test.sh"
