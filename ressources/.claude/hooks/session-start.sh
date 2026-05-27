#!/bin/bash
# SessionStart hook — prépare un environnement de travail complet pour
# Claude Code on the web : dépendances, .env.local, et une base Postgres
# locale seedée (le conteneur web n'a pas de daemon Docker, mais le serveur
# PostgreSQL est installé). Idempotent et non bloquant : un échec DB ne doit
# jamais empêcher la session de démarrer.
set -euo pipefail

# Uniquement en environnement distant (Claude Code on the web).
# En local, l'auteur utilise son propre flow `docker compose` (voir README).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# 1) Dépendances (npm install : profite du cache de conteneur post-hook).
if [ ! -d node_modules ]; then
  echo "session-start: npm install…"
  npm install
fi

# 2) Variables d'environnement de dev.
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "session-start: .env.local créé depuis .env.example"
fi

# 3) Postgres local + schéma + seed (best-effort, non bloquant).
# Postgres refuse de tourner en root : on lance initdb/pg_ctl sous le compte
# système « postgres » via runuser ; les connexions TCP (psql, drizzle) passent
# en auth « trust », indépendamment de l'utilisateur OS.
setup_db() {
  local PG_BIN PGDATA PGPORT PGUSER psql
  PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  PGDATA=/tmp/avqn-pgdata
  PGPORT=5434
  PGUSER=postgres

  [ -n "$PG_BIN" ] && [ -x "$PG_BIN/initdb" ] || {
    echo "session-start: serveur Postgres absent, étape DB ignorée"; return 0
  }
  command -v runuser >/dev/null 2>&1 && id "$PGUSER" >/dev/null 2>&1 || {
    echo "session-start: compte '$PGUSER' indisponible, étape DB ignorée"; return 0
  }

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"; chown "$PGUSER:$PGUSER" "$PGDATA"; chmod 700 "$PGDATA"
    runuser -u "$PGUSER" -- "$PG_BIN/initdb" -D "$PGDATA" --auth=trust >/dev/null
    printf "port = %s\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = '/tmp'\n" \
      "$PGPORT" >> "$PGDATA/postgresql.conf"
  fi

  if ! pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
    rm -f /tmp/avqn-pg.log; touch /tmp/avqn-pg.log; chown "$PGUSER:$PGUSER" /tmp/avqn-pg.log
    runuser -u "$PGUSER" -- "$PG_BIN/pg_ctl" -D "$PGDATA" -l /tmp/avqn-pg.log -w start
  fi
  pg_isready -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1 || {
    echo "session-start: Postgres n'a pas démarré (voir /tmp/avqn-pg.log)"; return 1
  }

  psql="psql -h 127.0.0.1 -p $PGPORT -U postgres -X -q -tA"
  $psql -c "SELECT 1 FROM pg_roles WHERE rolname='ressources'" | grep -q 1 || \
    $psql -c "CREATE ROLE ressources LOGIN PASSWORD 'ressources' SUPERUSER"
  $psql -c "SELECT 1 FROM pg_database WHERE datname='ressources'" | grep -q 1 || \
    $psql -c "CREATE DATABASE ressources OWNER ressources"

  npm run db:push
  npm run db:seed
  echo "session-start: base 'ressources' prête sur 127.0.0.1:$PGPORT"
}

setup_db || echo "session-start: étape DB ignorée (non bloquant)"
echo "session-start: prêt"
