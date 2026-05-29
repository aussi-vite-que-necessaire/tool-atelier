#!/usr/bin/env bash
# Synchronise le « noyau partagé » (le CONTRAT DE DONNÉES) depuis le projet
# propriétaire vers ses consommateurs déclarés. Source de vérité unique = le
# propriétaire ; les copies des consommateurs sont des artefacts générés.
#
# Pourquoi : `docs` et `ressources` tapent la MÊME base (backend partagé,
# lab.json: db.shared). Leurs définitions de schéma Drizzle doivent donc rester
# rigoureusement identiques, sinon une requête typée d'un côté diverge du schéma
# réel de l'autre → bugs silencieux. Tout le RESTE de la lib appartient à chaque
# projet (env, helpers, composants peuvent diverger légitimement entre l'admin et
# le public) — on ne synchronise QUE le contrat de données.
#
# Idempotent. La CI rejoue ce script puis `git diff --exit-code` : toute dérive
# (édition directe d'une copie, ou oubli de resync après édition de la source)
# casse le build. Pour resync à la main : `scripts/sync-shared.sh`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Propriétaire du schéma → consommateurs (backend partagé). Étendre si d'autres
# apps viennent à partager la base de `ressources`.
OWNER="ressources"
CONSUMERS=("docs")

# Chemins du contrat de données, relatifs à projects/<projet>/.
#   db/schema  → les tables Drizzle (le contrat critique)
#   db/index.ts → le client postgres-js paresseux (générique, lit DATABASE_URL)
SHARED=(
  "db/schema"
  "db/index.ts"
)

for consumer in "${CONSUMERS[@]}"; do
  for path in "${SHARED[@]}"; do
    src="$ROOT/projects/$OWNER/$path"
    dst="$ROOT/projects/$consumer/$path"
    [ -e "$src" ] || { echo "✗ source absente: $src"; exit 1; }
    mkdir -p "$(dirname "$dst")"
    if [ -d "$src" ]; then
      rm -rf "$dst"
      cp -r "$src" "$dst"
    else
      cp "$src" "$dst"
    fi
  done
  echo "✓ contrat de données synchronisé : $OWNER → $consumer"
done
