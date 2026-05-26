#!/usr/bin/env bash
# Déploie un projet sur lab. Exécuté SUR lab (copié par la CI). Le serveur ne build jamais :
# il pull l'image construite par la CI, puis compose up + écrit la route Caddy.
# Usage: deploy.sh <projet> <env> <image-ref>
set -euo pipefail

PROJ="$1"; ENV="$2"; IMAGE="$3"
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"
UPSTREAM="${PROJ}-${ENV}"
if [ "$ENV" = "prod" ]; then HOST="${PROJ}.lab.avqn.ch"; else HOST="${PROJ}-${ENV}.lab.avqn.ch"; fi

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

docker compose -p "${PROJ}-${ENV}" --env-file "$APPDIR/.env" -f "$APPDIR/compose.yml" up -d

mkdir -p /opt/lab/platform/sites
cat > "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy" <<EOF
${HOST} {
	reverse_proxy ${UPSTREAM}:8080
}
EOF
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile

echo "✓ déployé : https://${HOST}  (image ${IMAGE})"
