#!/usr/bin/env bash
# cartography.sh — régénère PROJECTS.md depuis la racine du repo.
# Usage : bash scripts/cartography.sh (depuis la racine)
# Dépendances : jq, curl ; gh facultatif (previews).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="$REPO_ROOT/PROJECTS.md"
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── détection des projets (dossier racine contenant un Dockerfile) ──────────
projects=()
for dir in "$REPO_ROOT"/*/; do
  name=$(basename "$dir")
  if [[ -f "$dir/Dockerfile" ]]; then
    projects+=("$name")
  fi
done

# ── helpers ─────────────────────────────────────────────────────────────────

get_description() {
  local lab="$REPO_ROOT/$1/lab.json"
  if [[ -f "$lab" ]]; then
    jq -r '.description // "—"' "$lab"
  else
    echo "—"
  fi
}

get_needs() {
  local lab="$REPO_ROOT/$1/lab.json"
  if [[ ! -f "$lab" ]]; then echo "—"; return; fi
  # collecte les clés booléennes à true (db, redis, email, …)
  local needs
  needs=$(jq -r 'to_entries | map(select(.value == true)) | map(.key) | join(",")' "$lab")
  if [[ -z "$needs" ]]; then echo "—"; else echo "$needs"; fi
}

get_stack() {
  local pkg="$REPO_ROOT/$1/package.json"
  if [[ ! -f "$pkg" ]]; then echo "—"; return; fi
  local content
  content=$(cat "$pkg")
  local stack="Node"
  # Next.js prend le dessus sur Node générique
  if echo "$content" | grep -q '"next"'; then stack="Next.js"; fi
  if echo "$content" | grep -q '"drizzle-orm"'; then stack="$stack+Drizzle"; fi
  if echo "$content" | grep -q '"better-auth"'; then stack="$stack+BetterAuth"; fi
  if echo "$content" | grep -q '"tailwindcss"'; then stack="$stack+Tailwind"; fi
  echo "$stack"
}

get_status() {
  local url="https://$1.lab.avqn.ch/healthz"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "🟢 up"
  else
    echo "🔴 down/$code"
  fi
}

# ── previews via gh ──────────────────────────────────────────────────────────
previews_section=""
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  branches=$(gh pr list --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
    --state open --json headRefName -q '.[].headRefName' 2>/dev/null || true)
  if [[ -z "$branches" ]]; then
    previews_section="aucune"
  else
    previews_section=""
    while IFS= read -r branch; do
      previews_section+="- \`$branch\`"$'\n'
    done <<< "$branches"
    previews_section="${previews_section%$'\n'}"
  fi
else
  previews_section="aucune (gh indisponible)"
fi

# ── construction du tableau ──────────────────────────────────────────────────
table_rows=""
for proj in "${projects[@]}"; do
  desc=$(get_description "$proj")
  needs=$(get_needs "$proj")
  stack=$(get_stack "$proj")
  url="https://$proj.lab.avqn.ch"
  status=$(get_status "$proj")
  table_rows+="| \`$proj\` | $desc | $stack | $needs | $url | $status |"$'\n'
done
table_rows="${table_rows%$'\n'}"

# ── écriture de PROJECTS.md ──────────────────────────────────────────────────
cat > "$OUTPUT" <<MARKDOWN
# Projets de l'atelier

> Carte vivante régénérée par \`scripts/cartography.sh\` (hook session-start + skill \`/lab-list\`). **Artefact généré, gitignoré, jamais édité à la main.**
> Dernière génération : $DATE

| Projet | Description | Stack | Besoins | URL prod | Statut |
|---|---|---|---|---|---|
$table_rows

## Previews ouvertes (PR)
$previews_section
MARKDOWN

echo "PROJECTS.md régénéré → $OUTPUT"
