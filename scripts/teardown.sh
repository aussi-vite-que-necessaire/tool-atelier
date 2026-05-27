#!/usr/bin/env bash
# Détruit un déploiement preview sur lab (jamais prod). Exécuté SUR lab (copié par la CI).
# Usage: teardown.sh <projet> <env>
set -euo pipefail

PROJ="$1"; ENV="$2"
[ "$ENV" = "prod" ] && { echo "refuse de teardown un env prod"; exit 1; }
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"

# Image de la preview, relevée avant la suppression de l'appdir pour la reprendre plus bas.
IMAGE=""
[ -f "$APPDIR/.env" ] && IMAGE="$(grep -m1 '^IMAGE=' "$APPDIR/.env" | cut -d= -f2-)"

if [ -f "$APPDIR/compose.yml" ]; then
  docker compose -p "${PROJ}-${ENV}" -f "$APPDIR/compose.yml" down || true
fi

# Reprend l'image de la preview (~1,5 G) maintenant que ses conteneurs sont partis. Tag propre à
# la branche, donc rien d'autre ne la sert. Ses couches partagées avec d'autres images restent.
if [ -n "$IMAGE" ]; then
  docker image rm -f "$IMAGE" >/dev/null 2>&1 || true
fi
rm -f "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy"
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile || true

# Drop la base preview (jamais prod : garde déjà posée plus haut)
DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
docker exec lab-platform-postgres-1 dropdb -U postgres --if-exists "${DBNAME}" || true

rm -rf "$APPDIR"
echo "✓ teardown ${PROJ}-${ENV} (base ${DBNAME} supprimée)"
