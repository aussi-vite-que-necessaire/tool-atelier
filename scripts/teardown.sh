#!/usr/bin/env bash
# Détruit un déploiement preview sur lab (jamais prod). Exécuté SUR lab (copié par la CI).
# Usage: teardown.sh <projet> <env>
set -euo pipefail

# Verrou global du lab — PARTAGÉ avec deploy.sh : c'est le même daemon Docker (la ressource
# mutable). Un teardown concurrent d'un deploy provoque les mêmes collisions de lease ; les
# sérialiser ensemble est cohérent. flock noyau, libéré à la mort du process, attente bornée.
acquire_deploy_lock() {
  exec 9>"${DEPLOY_LOCKFILE:-/opt/lab/deploy.lock}"
  flock -w "${DEPLOY_LOCK_TIMEOUT:-600}" 9 \
    || { echo "::error::verrou deploy non acquis après ${DEPLOY_LOCK_TIMEOUT:-600}s" >&2; exit 1; }
}

# Sourcé (tests) : on s'arrête après les définitions de fonctions, sans exécuter le teardown.
(return 0 2>/dev/null) && return 0

PROJ="$1"; ENV="$2"
[ "$ENV" = "prod" ] && { echo "refuse de teardown un env prod"; exit 1; }
acquire_deploy_lock
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

# Drop la base preview (jamais prod : garde déjà posée plus haut). --force termine les connexions
# résiduelles (conteneur pas encore tout à fait arrêté) au lieu de laisser une base orpheline.
DBNAME="${PROJ}_$(printf '%s' "$ENV" | tr '-' '_')"
docker exec lab-platform-postgres-1 dropdb -U postgres --force --if-exists "${DBNAME}" || true

rm -rf "$APPDIR"
echo "✓ teardown ${PROJ}-${ENV} (base ${DBNAME} supprimée)"
