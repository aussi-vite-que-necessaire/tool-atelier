#!/usr/bin/env bash
# Bases de données pour l'environnement de DEV LOCAL.
#
# deploy.sh provisionne <projet>_<env> sur le Postgres central (preview/prod). Ce script fait
# l'équivalent en local : il monte les dépendances sur la machine du dev pour itérer vite (hot
# reload, debug) sans cycle de déploiement. Il dérive les besoins de projects/<projet>/lab.json
# — la même déclaration que la prod — et écrit un .env.local prêt pour `npm run dev`.
#
# Modèle calqué sur la prod : UN Postgres local partagé par tout l'atelier (conteneur
# lab-dev-postgres), UNE base par projet (<projet>_dev). Idem Redis si déclaré. Local-first :
# rien ne quitte la machine, et un seul port hôte par service → pas de collision entre projets.
#
# Usage:
#   scripts/dev-db.sh up <projet>      # monte les deps, crée la base, migrate + seed, écrit .env.local
#   scripts/dev-db.sh reset <projet>   # drop puis recrée la base du projet (repart de zéro)
#   scripts/dev-db.sh down             # arrête les conteneurs partagés (données conservées)
#   scripts/dev-db.sh nuke             # supprime conteneurs + volume (tout effacé)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Conteneurs partagés du monde dev local (préfixe lab-dev-, réseau dédié, ports hôte fixes).
PG_CONTAINER="lab-dev-postgres"
PG_VOLUME="lab-dev-pgdata"
PG_PORT="5433"            # 5433 côté hôte pour ne pas heurter un Postgres système sur 5432
PG_PASSWORD="postgres"
PG_IMAGE="postgres:16-alpine"

REDIS_CONTAINER="lab-dev-redis"
REDIS_PORT="6379"
REDIS_IMAGE="redis:7-alpine"

NET="lab-dev"

need_docker() { command -v docker >/dev/null 2>&1 || { echo "✗ docker requis (non trouvé)"; exit 1; }; }
need_jq()     { command -v jq >/dev/null 2>&1 || { echo "✗ jq requis (non trouvé)"; exit 1; }; }

ensure_net() { docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null; }

running() { docker ps --format '{{.Names}}' | grep -qx "$1"; }
exists()  { docker ps -a --format '{{.Names}}' | grep -qx "$1"; }

pg_up() {
  ensure_net
  if ! running "$PG_CONTAINER"; then
    if exists "$PG_CONTAINER"; then
      docker start "$PG_CONTAINER" >/dev/null
    else
      docker run -d --name "$PG_CONTAINER" --network "$NET" \
        -e POSTGRES_PASSWORD="$PG_PASSWORD" \
        -p "127.0.0.1:${PG_PORT}:5432" \
        -v "${PG_VOLUME}:/var/lib/postgresql/data" \
        "$PG_IMAGE" >/dev/null
    fi
  fi
  # Attente que Postgres accepte les connexions avant createdb/migrate.
  for _ in $(seq 1 30); do
    docker exec "$PG_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "✗ Postgres local pas prêt après 30s"; exit 1
}

redis_up() {
  ensure_net
  if ! running "$REDIS_CONTAINER"; then
    if exists "$REDIS_CONTAINER"; then
      docker start "$REDIS_CONTAINER" >/dev/null
    else
      docker run -d --name "$REDIS_CONTAINER" --network "$NET" \
        -p "127.0.0.1:${REDIS_PORT}:6379" "$REDIS_IMAGE" >/dev/null
    fi
  fi
}

db_exists() { docker exec "$PG_CONTAINER" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1; }
create_db() { db_exists "$1" || docker exec "$PG_CONTAINER" createdb -U postgres "$1"; }
drop_db()   { docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"$1\" WITH (FORCE);" >/dev/null; }

# (Re)génère le .env.local avec les URLs locales. Le fichier est dev-only et gitignoré, donc on
# le régénère intégralement à chaque `up` — source de vérité = lab.json + ce script.
write_env_local() {
  local dir="$1" dburl="$2" redisurl="$3" prefix="$4"
  {
    echo "# Généré par scripts/dev-db.sh — environnement de DEV LOCAL. Ne pas committer."
    echo "APP_URL=http://localhost:3000"
    [ -n "$dburl" ]    && echo "DATABASE_URL=$dburl"
    [ -n "$redisurl" ] && { echo "REDIS_URL=$redisurl"; echo "REDIS_PREFIX=$prefix"; }
  } > "$dir/.env.local"
}

proj_dir() {
  local d="$ROOT/projects/$1"
  [ -d "$d" ] || { echo "✗ projet inconnu: $1 (cherché $d)"; exit 1; }
  printf '%s' "$d"
}

cmd_up() {
  need_docker; need_jq
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
    pg_up
    create_db "${proj}_dev"
    dburl="postgres://postgres:${PG_PASSWORD}@localhost:${PG_PORT}/${proj}_dev"
  fi
  if [ "$redis" = "true" ]; then
    redis_up
    redisurl="redis://localhost:${REDIS_PORT}"
    prefix="${proj}:dev:"
  fi

  write_env_local "$dir" "$dburl" "$redisurl" "$prefix"

  # Migrations puis seed, joués depuis le projet contre la base locale (comme une preview).
  # Nécessite les deps du projet installées (npm install).
  if [ "$db" = "true" ]; then
    export DATABASE_URL="$dburl"
    [ -n "$migrate" ] && ( cd "$dir" && sh -c "$migrate" )
    [ -n "$seed" ]    && ( cd "$dir" && sh -c "$seed" )
    unset DATABASE_URL
  fi

  if [ "$db" = "false" ] && [ "$redis" = "false" ]; then
    echo "ℹ $proj ne déclare ni db ni redis dans lab.json — .env.local minimal écrit."
  fi
  echo "✓ dev prêt pour $proj — .env.local écrit. Lance : (cd projects/$proj && npm run dev)"
}

cmd_reset() {
  need_docker; need_jq
  local proj="${1:?usage: dev-db.sh reset <projet>}"
  proj_dir "$proj" >/dev/null
  pg_up
  drop_db "${proj}_dev"
  echo "✓ base ${proj}_dev supprimée — recréation…"
  cmd_up "$proj"
}

cmd_down() {
  need_docker
  for c in "$PG_CONTAINER" "$REDIS_CONTAINER"; do
    running "$c" && docker stop "$c" >/dev/null && echo "⏹ $c arrêté"
  done
  echo "✓ conteneurs dev arrêtés (données conservées — 'up' pour relancer)."
}

cmd_nuke() {
  need_docker
  for c in "$PG_CONTAINER" "$REDIS_CONTAINER"; do docker rm -f "$c" >/dev/null 2>&1 || true; done
  docker volume rm "$PG_VOLUME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  echo "✓ monde dev local supprimé (conteneurs + volume)."
}

case "${1:-}" in
  up)    shift; cmd_up "$@";;
  reset) shift; cmd_reset "$@";;
  down)  shift; cmd_down "$@";;
  nuke)  shift; cmd_nuke "$@";;
  ""|-h|--help) sed -n '2,20p' "$0";;
  *) echo "commande inconnue: $1 (up|reset|down|nuke)"; exit 1;;
esac
