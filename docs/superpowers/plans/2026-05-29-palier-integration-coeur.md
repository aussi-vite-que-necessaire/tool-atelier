# Palier d'intégration — cœur (phases 1-3) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Faire de `main` le palier d'intégration (toute la suite assemblée sur `*.preview.contentos.ch`) et de la prod une promotion explicite d'artefact, doc à jour.

**Architecture:** `detect` mappe `main`→`integration`. `deploy.sh` gagne des fonctions pures de nommage (host/auth) testables, avec un cas `integration` (noms propres). Un workflow `promote` (`workflow_dispatch`) re-tague les images `:integration`→`:prod` sans rebuild puis déploie. `CLAUDE.md`/skill/hook réécrits.

**Tech Stack:** Bash (deploy.sh), GitHub Actions (deploy.yml, promote.yml), `docker buildx imagetools`, Markdown.

**Spec:** `docs/superpowers/specs/2026-05-29-palier-integration-preview-design.md`

---

### Task 1 : fonctions de nommage pures dans `deploy.sh` (TDD)

**Files:**
- Modify: `scripts/deploy.sh` (ajout de fonctions avant le garde source-safe L42 ; refonte du bloc host L51-62 et du bloc AUTH_URL ~L191-193)
- Create: `test/deploy-hosts.test.sh`

- [ ] **Step 1 — test rouge** `test/deploy-hosts.test.sh` : source `deploy.sh`, vérifie
  `compute_primary_host`, `compute_caddy_hosts`, `compute_auth_url` pour prod / integration /
  branche / www.

```bash
#!/usr/bin/env bash
set -uo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
ATELIER="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
DEPLOY="$ATELIER/scripts/deploy.sh"
eq() { [ "$1" = "$2" ] || fail "$3 — attendu '$2', obtenu '$1'"; }
h() { ( . "$DEPLOY" >/dev/null 2>&1; "$@" ); }

eq "$(h compute_primary_host media prod)"        "media.contentos.ch"                 "prod host"
eq "$(h compute_primary_host www prod)"          "contentos.ch"                        "prod www apex"
eq "$(h compute_caddy_hosts www prod)"           "contentos.ch, www.contentos.ch"      "prod www caddy"
eq "$(h compute_primary_host media integration)" "media.preview.contentos.ch"          "integration host"
eq "$(h compute_primary_host mcp integration)"   "mcp.preview.contentos.ch"            "integration mcp"
eq "$(h compute_primary_host media sharp-ride)"  "media-sharp-ride.preview.contentos.ch" "preview branche"
eq "$(h compute_auth_url prod)"                  ""                                    "auth prod vide"
eq "$(h compute_auth_url integration)"           "https://auth.preview.contentos.ch"   "auth integration"
eq "$(h compute_auth_url sharp-ride)"            "https://auth-sharp-ride.preview.contentos.ch" "auth branche"
echo "PASS: deploy-hosts.test.sh"
```

- [ ] **Step 2** : `bash test/deploy-hosts.test.sh` → FAIL (fonctions absentes).

- [ ] **Step 3 — implémentation** : ajouter avant L42 (garde source-safe) :

```bash
# Host public primaire selon l'env (fonction pure, testable) :
#   prod        → <projet>.contentos.ch (cas www → apex contentos.ch)
#   integration → <projet>.preview.contentos.ch (noms propres, suite assemblée)
#   <branche>   → <projet>-<branche>.preview.contentos.ch (preview par-branche)
compute_primary_host() {
  local proj="$1" env="$2"
  if [ "$env" = "prod" ]; then
    if [ "$proj" = "www" ]; then echo "contentos.ch"; else echo "${proj}.contentos.ch"; fi
  elif [ "$env" = "integration" ]; then
    echo "${proj}.preview.contentos.ch"
  else
    echo "${proj}-${env}.preview.contentos.ch"
  fi
}
# Liste Caddy (virgule) : www en prod sert apex + www, sinon = host primaire.
compute_caddy_hosts() {
  local proj="$1" env="$2"
  if [ "$env" = "prod" ] && [ "$proj" = "www" ]; then
    echo "contentos.ch, www.contentos.ch"
  else
    compute_primary_host "$proj" "$env"
  fi
}
# AUTH_URL injecté hors prod : integration → auth.preview (nom propre) ; branche → auth-<branche>.preview ;
# prod → vide (défaut applicatif / secret s'applique).
compute_auth_url() {
  local env="$1"
  if [ "$env" = "prod" ]; then echo ""
  elif [ "$env" = "integration" ]; then echo "https://auth.preview.contentos.ch"
  else echo "https://auth-${env}.preview.contentos.ch"; fi
}
```

  Puis remplacer le bloc host L51-62 par :

```bash
PRIMARY_HOST="$(compute_primary_host "$PROJ" "$ENV")"
HOSTS_CADDY="$(compute_caddy_hosts "$PROJ" "$ENV")"
```

  Et le bloc AUTH_URL (`if [ "$ENV" != "prod" ]; then sed…; printf auth-<env>…`) par :

```bash
auth_url="$(compute_auth_url "$ENV")"
if [ -n "$auth_url" ]; then
  sed -i '/^AUTH_URL=/d' "$APPDIR/.env"
  printf 'AUTH_URL=%s\n' "$auth_url" >> "$APPDIR/.env"
fi
```

- [ ] **Step 4** : `bash test/deploy-hosts.test.sh` → PASS ; `bash test/deploy-retry.test.sh` → PASS (non-régression) ; `shellcheck --severity=warning scripts/deploy.sh`.

- [ ] **Step 5 — commit** : `feat(deploy): cas integration dans le nommage host/auth (fonctions pures testées)`.

### Task 2 : `detect` mappe `main` → `integration` (deploy.yml)

**Files:** Modify `.github/workflows/deploy.yml` (step `env`, L68-69)

- [ ] **Step 1** : remplacer `if [ "$ref" = "main" ]; then e=prod; else` par `if [ "$ref" = "main" ]; then e=integration; else`. Mettre à jour le commentaire.
- [ ] **Step 2** : commit `feat(ci): main déploie désormais l'intégration (env=integration)`.

### Task 3 : workflow `promote` (prod par re-tag d'artefact)

**Files:** Create `.github/workflows/promote.yml`

- [ ] **Step 1** : écrire le workflow `workflow_dispatch` : job `resolve` (liste des projets, input optionnel), job `promote` (matrix `max-parallel:1` : `docker buildx imagetools create` `:integration`→`:prod` mono/multi, puis SSH lab `deploy.sh <proj> prod <images:prod>` — bloc scp identique à deploy.yml), job `tag` (pousse un tag `prod-<date>`). Permissions `contents:write`+`packages:write`. (Code complet rédigé à l'implémentation, modelé sur le job `deploy` de deploy.yml.)
- [ ] **Step 2** : `actionlint .github/workflows/promote.yml` (si dispo) ; sinon revue manuelle YAML.
- [ ] **Step 3** : commit `feat(ci): workflow promote — prod par re-tag :integration→:prod sans rebuild`.

### Task 4 : doc & skills (le modèle change)

**Files:** Modify `CLAUDE.md`, `.claude/skills/nouveau-projet/SKILL.md`, `.claude/hooks/session-start.sh`

- [ ] **Step 1** : `CLAUDE.md` — section « Workflow & isolation » et « Déployer » : « Merge de PR → prod » devient « Merge de PR → **intégration** (`*.preview.contentos.ch`, suite assemblée) ; **promotion explicite → prod** (`*.contentos.ch`) via le workflow `promote` ». Ajouter `APP_URL` integration dans la section Données. Mettre à jour l'entonnoir (PR → merge → intégration → promotion → prod).
- [ ] **Step 2** : `nouveau-projet/SKILL.md` — « déploiement jusqu'en prod » → « jusqu'en intégration ; prod = promotion ». (Vérifier le wording exact avant edit.)
- [ ] **Step 3** : `session-start.sh` — message « PR mergée = prod » → « PR mergée = intégration ; prod = promotion ». Vérifier `test/session-start.test.sh` (n'assère pas ce wording — OK) ; lancer le test.
- [ ] **Step 4** : commit `docs: modèle intégration→promotion (CLAUDE.md, nouveau-projet, session-start)`.

### Task 5 : push + PR

- [ ] Push `claude/sharp-ride-R2vGb`, ouvrir la PR (base `main`), récap avec liens preview + PR.

## Hors périmètre (suites)

- Guard CI anti-`NEXT_PUBLIC_*`-URL (aucune violation aujourd'hui — YAGNI, à ajouter avec le 1er besoin).
- Seed d'intégration enrichi / clone anonymisé prod (réservé, suite non live).
- Phase 4 : projet `e2e/` + gate de promotion (idée dédiée).

## Self-review

- Couverture spec : modèle (Task 2), nommage/AUTH (Task 1), promotion (Task 3), doc (Task 4). ✓
- Pas de placeholder de code dans les tâches testables (Task 1 complète). Task 3 = YAML volumineux rédigé à l'impl (non testable en TDD).
- Cohérence noms : `compute_primary_host`/`compute_caddy_hosts`/`compute_auth_url` identiques partout. ✓
- Bootstrap : le merge de cette PR touche la plomberie (deploy.sh + deploy.yml) → règle « plomberie → rebuild tous » → toute la suite se déploie d'un coup en intégration. ✓
