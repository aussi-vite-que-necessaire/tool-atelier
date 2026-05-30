#!/usr/bin/env bash
# Environnement de DONNÉES pour le DEV — pensé pour les agents qui codent sur un projet.
#
# deploy.sh provisionne app_<env> sur le Postgres central (preview/prod). Ce script fait
# l'équivalent côté dev : il monte les dépendances déclarées dans lab.json (racine, la *même*
# déclaration que la prod) puis écrit le .env pour que `npm run dev` et les tests qui touchent
# la base démarrent du premier coup. Aucun cycle de déploiement.
#
# CIBLE : sessions cloud (conteneur isolé, root, PAS de daemon Docker). On utilise donc
# PostgreSQL en NATIF (le serveur, pas Docker) : installé via apt si absent, lancé via le
# cluster Debian `main` (pg_ctlcluster gère le drop de privilèges — Postgres refuse de tourner
# en root). Redis idem (binaire natif, daemonisé). Marche aussi en local si le serveur Postgres
# y est installé ; sur une machine sans Postgres natif (ex. macOS sans paquet), installer
# Postgres ou utiliser Docker reste à faire à la main — voir le bloc « Dev local » du CLAUDE.md.
#
# Modèle calqué sur la prod : UN cluster Postgres, les bases app_dev (dev) et app_test (tests).
#
# Usage (le projet vaut `app` par défaut) :
#   scripts/dev-db.sh up       # monte les deps, crée app_dev (+app_test), migrate + seed, écrit .env
#   scripts/dev-db.sh reset    # drop puis recrée app_dev (repart de zéro)
#   scripts/dev-db.sh down     # arrête les services partagés (Postgres + Redis ; données conservées)
#   scripts/dev-db.sh nuke     # drop app_dev et app_test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PG_VERSION="16"
PG_CLUSTER="main"
PG_HOST="127.0.0.1"
PG_PORT="5432"           # port du cluster Debian par défaut
PG_USER="postgres"
PG_PASSWORD="postgres"   # superutilisateur, sert aux opérations admin (createdb, rôles)
# Rôle applicatif `app` : LA convention de l'atelier pour les bases dev/test. Le job `test`
# de la CI tourne sur un Postgres `app:app`, et les `.env.test` committés des projets pointent
# sur postgres://app:app@localhost/<projet>_test. On reproduit ce rôle en local pour que les
# `npm test` qui touchent la base passent sans bricolage par projet.
APP_USER="app"
APP_PASSWORD="app"

REDIS_PORT="6379"

psql_admin() { PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -tAc "$1"; }

need_jq() { command -v jq >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq jq; }; }

# Installe le serveur Postgres si seul le client est présent (cas des conteneurs cloud), puis
# démarre le cluster Debian `main` et pose un mot de passe connu pour les connexions TCP.
ensure_pg() {
  if [ ! -x "/usr/lib/postgresql/${PG_VERSION}/bin/initdb" ]; then
    echo "→ installation de postgresql-${PG_VERSION} (serveur absent)…"
    apt-get update -qq && apt-get install -y -qq "postgresql-${PG_VERSION}"
  fi
  # Le paquet crée le cluster `main`. Le démarrer s'il est down (pas de systemd ici).
  if ! pg_lsclusters -h 2>/dev/null | awk '{print $1,$2,$4}' | grep -q "^${PG_VERSION} ${PG_CLUSTER} online$"; then
    pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" start >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 30); do
    pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1 && break
    sleep 1
  done
  pg_isready -h "$PG_HOST" -p "$PG_PORT" >/dev/null 2>&1 || { echo "✗ Postgres pas prêt après 30s"; exit 1; }
  # Mot de passe du rôle postgres (idempotent) — via le socket local en peer auth (utilisateur OS postgres).
  su postgres -c "psql -tAc \"ALTER USER ${PG_USER} PASSWORD '${PG_PASSWORD}'\"" >/dev/null 2>&1 || true
  # Rôle applicatif `app` (idempotent) : LOGIN + CREATEDB (db:test:prepare des projets crée sa base).
  su postgres -c "psql -tAc \"DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${APP_USER}') THEN CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}' CREATEDB; END IF; END \\\$\\\$;\"" >/dev/null 2>&1 || true
}

ensure_redis() {
  command -v redis-server >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq redis-server; }
  redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 || redis-server --daemonize yes --port "$REDIS_PORT" >/dev/null 2>&1
}

db_exists()  { [ "$(psql_admin "SELECT 1 FROM pg_database WHERE datname='$1'")" = "1" ]; }
create_db()  { db_exists "$1" || psql_admin "CREATE DATABASE \"$1\"" >/dev/null; }
drop_db()    { psql_admin "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE)" >/dev/null; }

# (Re)génère le `.env` du projet. On écrit `.env` (et non `.env.local`) car c'est le fichier que
# lisent à la fois `next dev`, le worker (`--env-file .env`) ET vitest (`loadEnv()` dans
# vitest.config). `.env` est gitignoré (racine + par projet). Dev-only, régénéré intégralement à
# chaque `up` (source de vérité = lab.json + ce script). Reproduit ce que la plateforme/CI injecte :
# APP_URL, DATABASE_URL, REDIS_URL — plus un BETTER_AUTH_SECRET de dev pour les projets à auth.
write_env() {
  local dir="$1" dburl="$2" redisurl="$3" prefix="$4"
  {
    echo "# Généré par scripts/dev-db.sh — environnement de DEV LOCAL. Ne pas committer."
    echo "APP_URL=http://localhost:3000"
    [ -n "$dburl" ]    && echo "DATABASE_URL=$dburl"
    [ -n "$redisurl" ] && { echo "REDIS_URL=$redisurl"; echo "REDIS_PREFIX=$prefix"; }
    echo "BETTER_AUTH_SECRET=dev-local-not-a-secret"
  } > "$dir/.env"
  return 0   # sinon le dernier test (redisurl vide → 1) devient le code retour et `set -e` tue le script
}

# Mono-app : l'app vit à la racine du dépôt. Le « projet » est toujours `app`
# (bases app_dev / app_test, préfixe redis app:dev:), son dir est $ROOT.
proj_dir() { printf '%s' "$ROOT"; }

# URL applicative (rôle `app`) — celle qu'écrivent les `.env`/`.env.test` des projets et la CI.
dburl_for() { printf 'postgres://%s:%s@%s:%s/%s' "$APP_USER" "$APP_PASSWORD" "$PG_HOST" "$PG_PORT" "$1"; }

cmd_up() {
  need_jq
  local proj="${1:-app}"
  local dir; dir="$(proj_dir "$proj")"
  local lab="$dir/lab.json"
  local db=false redis=false migrate="" seed="" db_shared_from=""
  if [ -f "$lab" ]; then
    # .db : true (base propre) | {"shared":"X"} (réutilise X_dev) | false.
    db="$(jq -r 'if (.db|type)=="object" then "shared" elif (.db // false) then "true" else "false" end' "$lab")"
    db_shared_from="$(jq -r '(.db | objects | .shared) // empty' "$lab")"
    redis="$(jq -r '.redis // false' "$lab")"
    migrate="$(jq -r '.migrate // empty' "$lab")"
    seed="$(jq -r '.seed // empty' "$lab")"
  fi

  local dburl="" redisurl="" prefix=""
  if [ "$db" = "true" ]; then
    ensure_pg
    create_db "${proj}_dev"
    create_db "${proj}_test"   # base de test prête pour `npm test` (cf. db:test:prepare des projets)
    dburl="$(dburl_for "${proj}_dev")"
  elif [ "$db" = "shared" ]; then
    # Backend partagé : on pointe sur la base dev du projet propriétaire, sans rien créer ni migrer.
    ensure_pg
    db_exists "${db_shared_from}_dev" \
      || echo "⚠ base partagée ${db_shared_from}_dev absente — lance d'abord: scripts/dev-db.sh up ${db_shared_from}"
    dburl="$(dburl_for "${db_shared_from}_dev")"
  fi
  if [ "$redis" = "true" ]; then
    ensure_redis
    redisurl="redis://localhost:${REDIS_PORT}"
    prefix="${proj}:dev:"
  fi

  write_env "$dir" "$dburl" "$redisurl" "$prefix"

  if [ "$db" = "true" ]; then
    # Deps du projet (migrate/seed/db:test:prepare en ont besoin). En session cloud,
    # cloud-setup.sh le fait au boot ; on installe ici pour rendre `up` autonome.
    if [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ]; then
      echo "→ installation des deps de $proj (node_modules absent)…"
      ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } >/dev/null )
    fi
    # Base de DEV : migrate puis seed contre <projet>_dev (comme une preview).
    export DATABASE_URL="$dburl"
    [ -n "$migrate" ] && ( cd "$dir" && sh -c "$migrate" )
    [ -n "$seed" ]    && ( cd "$dir" && sh -c "$seed" )
    unset DATABASE_URL
    # Base de TEST : on délègue au `db:test:prepare` du projet (s'il existe) pour la migrer
    # comme le fait la CI. On lui passe l'env de test (DATABASE_URL = <projet>_test + APP_URL/REDIS_URL).
    if [ -f "$dir/package.json" ] && grep -q '"db:test:prepare"' "$dir/package.json"; then
      ( cd "$dir"
        export DATABASE_URL="$(dburl_for "${proj}_test")" APP_URL="http://localhost:3000"
        [ -n "$redisurl" ] && export REDIS_URL="$redisurl"
        npm run db:test:prepare --if-present )
    fi
  elif [ "$db" = "shared" ]; then
    # Pas de migrate/seed (base gérée par le propriétaire) ; on installe juste les deps pour `npm run dev`.
    if [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ]; then
      echo "→ installation des deps de $proj (node_modules absent)…"
      ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } >/dev/null )
    fi
  fi

  if [ "$db" = "false" ] && [ "$redis" = "false" ]; then
    echo "ℹ $proj ne déclare ni db ni redis dans lab.json — .env minimal écrit."
  fi
  echo "✓ dev prêt pour $proj — .env écrit. Lance : npm run dev"
  [ "$db" = "true" ] && echo "  tests : bases ${proj}_dev + ${proj}_test prêtes → npm test"
  return 0
}

cmd_reset() {
  need_jq
  local proj="${1:-app}"
  proj_dir "$proj" >/dev/null
  ensure_pg
  drop_db "${proj}_dev"
  echo "✓ base ${proj}_dev supprimée — recréation…"
  cmd_up "$proj"
}

cmd_down() {
  pg_ctlcluster "$PG_VERSION" "$PG_CLUSTER" stop >/dev/null 2>&1 && echo "⏹ Postgres arrêté" || true
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 && echo "⏹ Redis arrêté" || true
  echo "✓ services dev arrêtés (données conservées — 'up' pour relancer)."
}

cmd_nuke() {
  local proj="${1:-app}"
  ensure_pg
  drop_db "${proj}_dev"
  drop_db "${proj}_test"
  echo "✓ bases ${proj}_dev et ${proj}_test supprimées."
}

case "${1:-}" in
  up)    shift; cmd_up "$@";;
  reset) shift; cmd_reset "$@";;
  down)  shift; cmd_down "$@";;
  nuke)  shift; cmd_nuke "$@";;
  ""|-h|--help) sed -n '2,24p' "$0";;
  *) echo "commande inconnue: $1 (up|reset|down|nuke)"; exit 1;;
esac
