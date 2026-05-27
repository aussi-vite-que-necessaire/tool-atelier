#!/usr/bin/env bash
# Déploie un projet sur lab. Exécuté SUR lab (copié par la CI). Le serveur ne build jamais :
# il pull l'image construite par la CI, auto-provisionne les données déclarées dans lab.json,
# puis compose up + écrit la route Caddy.
# Usage: deploy.sh <projet> <env> <image-ref>
set -euo pipefail

PROJ="$1"; ENV="$2"; IMAGE="$3"
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"
UPSTREAM="${PROJ}-${ENV}"
if [ "$ENV" = "prod" ]; then HOST="${PROJ}.lab.avqn.ch"; else HOST="${PROJ}-${ENV}.lab.avqn.ch"; fi

# jq requis pour lire lab.json — auto-install si absent (serveur fraîchement provisionné)
command -v jq >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq jq; }
# age requis pour déchiffrer les secrets — auto-install si absent
command -v age >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq age; }

# Auth GHCR (images privées) si un token est posé sur le serveur
if [ -f /opt/lab/ghcr.env ]; then
  # shellcheck disable=SC1091
  . /opt/lab/ghcr.env
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

docker pull "$IMAGE"

mkdir -p "$APPDIR"
umask 077
cat > "$APPDIR/.env" <<EOF
IMAGE=$IMAGE
UPSTREAM=$UPSTREAM
APP_ENV=$ENV
EOF

# Besoins déclarés par le projet (lab.json absent => projet sans base ni redis)
DB=false; REDIS=false; EMAIL=false; BROWSER=false; MIGRATE=""; SEED=""
if [ -f "$APPDIR/lab.json" ]; then
  DB="$(jq -r '.db // false' "$APPDIR/lab.json")"
  REDIS="$(jq -r '.redis // false' "$APPDIR/lab.json")"
  EMAIL="$(jq -r '.email // false' "$APPDIR/lab.json")"
  BROWSER="$(jq -r '.browser // false' "$APPDIR/lab.json")"
  MIGRATE="$(jq -r '.migrate // empty' "$APPDIR/lab.json")"
  SEED="$(jq -r '.seed // empty' "$APPDIR/lab.json")"
fi

# Postgres central : base <projet>_<env> + DATABASE_URL injecté
if [ "$DB" = "true" ]; then
  # shellcheck disable=SC1091
  . /opt/lab/platform/.env   # LAB_POSTGRES_PASSWORD
  DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
  docker exec lab-platform-postgres-1 psql -U postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DBNAME}'" | grep -q 1 \
    || docker exec lab-platform-postgres-1 createdb -U postgres "${DBNAME}"
  printf 'DATABASE_URL=postgres://postgres:%s@postgres:5432/%s\n' "$LAB_POSTGRES_PASSWORD" "$DBNAME" >> "$APPDIR/.env"
fi

# Redis central : URL + préfixe de namespace
if [ "$REDIS" = "true" ]; then
  printf 'REDIS_URL=redis://redis:6379\nREDIS_PREFIX=%s:%s:\n' "$PROJ" "$ENV" >> "$APPDIR/.env"
fi

# Chromium partagé (browserless central sur le réseau lab) : URL CDP injectée
if [ "$BROWSER" = "true" ]; then
  # /opt/lab/platform/.env porte LAB_BROWSER_URL (ex. ws://browser:3000?token=…)
  LAB_BROWSER_URL=""
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  if [ -n "${LAB_BROWSER_URL:-}" ]; then
    printf 'BROWSER_URL=%s\n' "$LAB_BROWSER_URL" >> "$APPDIR/.env"
  else
    echo "⚠ browser: true mais LAB_BROWSER_URL absent de /opt/lab/platform/.env (skip) — provisionner browserless."
  fi
fi

# Email partagé (Resend) : clé de plateforme injectée si déclaré et disponible sur lab
if [ "$EMAIL" = "true" ]; then
  # /opt/lab/platform/.env porte RESEND_API_KEY (+ EMAIL_FROM) au niveau plateforme
  RESEND_API_KEY=""; EMAIL_FROM=""
  [ -f /opt/lab/platform/.env ] && . /opt/lab/platform/.env
  if [ -n "${RESEND_API_KEY:-}" ]; then
    printf 'RESEND_API_KEY=%s\nEMAIL_FROM=%s\n' "$RESEND_API_KEY" "${EMAIL_FROM:-onboarding@resend.dev}" >> "$APPDIR/.env"
  else
    echo "⚠ email: true mais RESEND_API_KEY absent de /opt/lab/platform/.env (skip) — poser la clé une fois pour activer."
  fi
fi

# Secrets applicatifs chiffrés (age) : global puis projet, déchiffrés avec la clé posée sur lab
# (/opt/lab/secrets-key) et injectés dans l'env partagé (web + worker + migrate one-shot).
# Ordre : global d'abord, projet ensuite → le projet peut surcharger une valeur globale.
# sysadmin n'est JAMAIS injecté. Fichiers copiés par la CI dans $APPDIR (déjà chiffrés).
if [ -f /opt/lab/secrets-key ]; then
  [ -f "$APPDIR/global.env.age" ]          && age -d -i /opt/lab/secrets-key "$APPDIR/global.env.age"          >> "$APPDIR/.env"
  [ -f "$APPDIR/${PROJ}.env.age" ]         && age -d -i /opt/lab/secrets-key "$APPDIR/${PROJ}.env.age"         >> "$APPDIR/.env"
fi

# Origine publique du déploiement : primitive générique connue de la plateforme seule
# (elle attribue le host). Écrite APRÈS les secrets pour être autoritative — en --env-file
# la dernière occurrence d'une clé gagne, donc un secret périmé ne peut pas la masquer.
printf 'APP_URL=https://%s\n' "$HOST" >> "$APPDIR/.env"

# Migrations (toujours) puis seed (hors prod) — conteneur one-shot sur le réseau lab
if [ -n "$MIGRATE" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$IMAGE" sh -c "$MIGRATE"
fi
if [ -n "$SEED" ] && [ "$ENV" != "prod" ]; then
  docker run --rm --network lab --env-file "$APPDIR/.env" "$IMAGE" sh -c "$SEED"
fi

# --force-recreate : applique les changements de .env (secrets) même quand l'image est identique
# (sinon une rotation de secret seule ne serait pas prise en compte).
docker compose -p "${PROJ}-${ENV}" --env-file "$APPDIR/.env" -f "$APPDIR/compose.yml" up -d --force-recreate

mkdir -p /opt/lab/platform/sites
cat > "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy" <<EOF
${HOST} {
	reverse_proxy ${UPSTREAM}:8080
}
EOF
docker exec lab-platform-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile

echo "✓ déployé : https://${HOST}  (image ${IMAGE})"
