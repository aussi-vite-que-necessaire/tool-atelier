#!/usr/bin/env bash
# Détruit un déploiement preview sur lab (jamais prod). Exécuté SUR lab (copié par la CI).
# Usage: teardown.sh <projet> <env>
set -euo pipefail

PROJ="$1"; ENV="$2"
[ "$ENV" = "prod" ] && { echo "refuse de teardown un env prod"; exit 1; }
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"

if [ -f "$APPDIR/compose.yml" ]; then
  docker compose -p "${PROJ}-${ENV}" -f "$APPDIR/compose.yml" down || true
fi
rm -f "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy"
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile || true
rm -rf "$APPDIR"
# plan 2b : drop de la base ${PROJ}_${ENV}
echo "✓ teardown ${PROJ}-${ENV}"
