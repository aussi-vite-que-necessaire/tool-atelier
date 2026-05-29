#!/usr/bin/env bash
# Environnement de DONNÉES pour le DEV — pensé pour les agents qui codent sur un projet.
#
# deploy.sh provisionne <projet>_<env> sur le Postgres central (preview/prod). Ce script fait
# l'équivalent côté dev : il monte les dépendances déclarées dans projects/<projet>/lab.json
# (la *même* déclaration que la prod) puis écrit le .env.local pour que `npm run dev` et les
# tests qui touchent la base démarrent du premier coup. Aucun cycle de déploiement.
#
# CIBLE : sessions cloud (conteneur isolé, root, PAS de daemon Docker). On utilise donc
# PostgreSQL en NATIF (le serveur, pas Docker) : installé via apt si absent, lancé via le
# cluster Debian `main` (pg_ctlcluster gère le drop de privilèges — Postgres refuse de tourner
# en root). Redis idem (binaire natif, daemonisé). Marche aussi en local si le serveur Postgres
# y est installé ; sur une machine sans Postgres natif (ex. macOS sans paquet), installer
# Postgres ou utiliser Docker reste à faire à la main — voir le bloc « Dev local » du CLAUDE.md.
#
# Modèle calqué sur la prod : UN cluster Postgres partagé par l'atelier, UNE base par projet
# (<projet>_dev pour le dev, <projet>_test pour les tests).
#
# Usage:
#   scripts/dev-db.sh up <projet>      # monte les deps, crée <projet>_dev (+_test), migrate + seed, écrit .env.local
#   scripts/dev-db.sh reset <projet>   # drop puis recrée <projet>_dev (repart de zéro)
#   scripts/dev-db.sh down             # arrête les services partagés (Postgres + Redis ; données conservées)
#   scripts/dev-db.sh nuke <projet>    # drop <projet>_dev et <projet>_test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PG_VERSION="16"
PG_CLUSTER="main"
PG_HOST="127.0.0.1"
PG_PORT="5432"           # port du cluster Debian par défaut
PG_USER="postgres"
PG_PASSWORD="postgres"   # mot de passe de dev local (jamais hors de la machine)

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
}

ensure_redis() {
  command -v redis-server >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq redis-server; }
  redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1 || redis-server --daemonize yes --port "$REDIS_PORT" >/dev/null 2>&1
}

db_exists()  { [ "$(psql_admin "SELECT 1 FROM pg_database WHERE datname='$1'")" = "1" ]; }
create_db()  { db_exists "$1" || psql_admin "CREATE DATABASE \"$1\"" >/dev/null; }
drop_db()    { psql_admin "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE)" >/dev/null; }

# (Re)génère le .env.local. Dev-only et gitignoré (.env*.local) → régénéré intégralement à
# chaque `up` ; source de vérité = lab.json + ce script.
write_env_local() {
  local dir="$1" dburl="$2" redisurl="$3" prefix="$4"
  {
    echo "# Généré par scripts/dev-db.sh — environnement de DEV LOCAL. Ne pas committer."
    echo "APP_URL=http://localhost:3000"
    [ -n "$dburl" ]    && echo "DATABASE_URL=$dburl"
    [ -n "$redisurl" ] && { echo "REDIS_URL=$redisurl"; echo "REDIS_PREFIX=$prefix"; }
  } > "$dir/.env.local"
  return 0   # sinon le dernier test (redisurl vide → 1) devient le code retour et `set -e` tue le script
}

proj_dir() {
  local d="$ROOT/projects/$1"
  [ -d "$d" ] || { echo "✗ projet inconnu: $1 (cherché $d)"; exit 1; }
  printf '%s' "$d"
}

dburl_for() { printf 'postgres://%s:%s@%s:%s/%s' "$PG_USER" "$PG_PASSWORD" "$PG_HOST" "$PG_PORT" "$1"; }

cmd_up() {
  need_jq
  local proj="${1:?usage: dev-db.sh up <projet>}"
  local dir; dir="$(proj_dir "$proj")"
  local lab="$dir/lab.json"
  local db=false redis=false migrate="" seed=""
  if [ -f "$lab" ]; then
    db="$(jq -r '.db // false' "$lab")"
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
  fi
  if [ "$redis" = "true" ]; then
    ensure_redis
    redisurl="redis://localhost:${REDIS_PORT}"
    prefix="${proj}:dev:"
  fi

  write_env_local "$dir" "$dburl" "$redisurl" "$prefix"

  # Migrations puis seed, joués depuis le projet contre <projet>_dev (comme une preview).
  # migrate/seed ont besoin des deps du projet : on les installe si absentes (en session
  # cloud, cloud-setup.sh le fait au boot, mais on rend `up` autonome).
  if [ "$db" = "true" ] && { [ -n "$migrate" ] || [ -n "$seed" ]; }; then
    if [ -f "$dir/package.json" ] && [ ! -d "$dir/node_modules" ]; then
      echo "→ installation des deps de $proj (node_modules absent)…"
      ( cd "$dir" && { [ -f package-lock.json ] && npm ci || npm install; } >/dev/null )
    fi
    export DATABASE_URL="$dburl"
    [ -n "$migrate" ] && ( cd "$dir" && sh -c "$migrate" )
    [ -n "$seed" ]    && ( cd "$dir" && sh -c "$seed" )
    unset DATABASE_URL
  fi

  if [ "$db" = "false" ] && [ "$redis" = "false" ]; then
    echo "ℹ $proj ne déclare ni db ni redis dans lab.json — .env.local minimal écrit."
  fi
  echo "✓ dev prêt pour $proj — .env.local écrit. Lance : (cd projects/$proj && npm run dev)"
  [ "$db" = "true" ] && echo "  tests : base ${proj}_test prête → DATABASE_URL=$(dburl_for "${proj}_test") npm test"
  return 0
}

cmd_reset() {
  need_jq
  local proj="${1:?usage: dev-db.sh reset <projet>}"
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
  local proj="${1:?usage: dev-db.sh nuke <projet>}"
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
