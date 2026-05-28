#!/usr/bin/env bash
# Détruit un déploiement preview sur lab (jamais prod). Exécuté SUR lab (copié par la CI).
# Usage: teardown.sh <projet> <env>
set -euo pipefail

PROJ="$1"; ENV="$2"
[ "$ENV" = "prod" ] && { echo "refuse de teardown un env prod"; exit 1; }
APPDIR="/opt/lab/apps/${PROJ}-${ENV}"

# Images de la preview, relevées avant la suppression de l'appdir pour les reprendre plus bas.
# Format mono : IMAGE=… ; multi-rôles : une ligne IMAGE_<ROLE>=… par rôle (cf. deploy.sh).
IMAGES=()
if [ -f "$APPDIR/.env" ]; then
  while IFS= read -r line; do
    IMAGES+=("${line#*=}")
  done < <(grep -E '^IMAGE(_[A-Z]+)?=' "$APPDIR/.env" || true)
fi

if [ -f "$APPDIR/compose.yml" ]; then
  docker compose -p "${PROJ}-${ENV}" -f "$APPDIR/compose.yml" down || true
fi

# Reprend les images de la preview (~1,5 G) maintenant que ses conteneurs sont partis. Tag propre
# à la branche, donc rien d'autre ne les sert. Leurs couches partagées avec d'autres images restent.
for img in "${IMAGES[@]}"; do
  [ -n "$img" ] && docker image rm -f "$img" >/dev/null 2>&1 || true
done
rm -f "/opt/lab/platform/sites/${PROJ}-${ENV}.caddy"
docker exec lab-platform-caddy-1 caddy reload --config /etc/caddy/Caddyfile || true

# Drop la base preview (jamais prod : garde déjà posée plus haut)
DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
docker exec lab-platform-postgres-1 dropdb -U postgres --if-exists "${DBNAME}" || true

rm -rf "$APPDIR"
echo "✓ teardown ${PROJ}-${ENV} (base ${DBNAME} supprimée)"
