# Plan — alléger les tests contentos + corriger l'APP_URL des previews

> **Pour exécutants agentiques :** SOUS-SKILL REQUISE : `superpowers:executing-plans` (exécution
> inline) ou `superpowers:subagent-driven-development`. Étapes en cases à cocher (`- [ ]`).

**But :** rendre la suite de tests rapide et utile (gate CI + smoke e2e minimal) et injecter un
`APP_URL` correct par environnement, sans logique par projet dans la plateforme.

**Architecture :** `deploy.sh` injecte l'origine publique comme primitive générique ; `deploy.yml`
gagne un job `test` (matrice par projet changé, services Postgres/Redis lus depuis `lab.json`) qui
garde le job `deploy` ; les e2e contentos sont réduits au seul `auth.spec.ts`.

**Stack :** bash, GitHub Actions, vitest, Playwright, Next.js, Drizzle, BullMQ.

**Note commits :** les commits se font sur la branche `work/contentos-optimiser-build-feature-preview`
uniquement, jamais sur `main`. Style gitmoji (cf. historique), pied de page `Co-Authored-By`.

---

## File Structure

- `scripts/deploy.sh` — +1 ligne d'injection `APP_URL` après le bloc des secrets `age`.
- `.github/workflows/deploy.yml` — nouveau job `test` ; `deploy` dépend de `[detect, test]`.
- `contentos/test/e2e/` — ne reste que `auth.spec.ts` + `global-setup.ts` ; 14 specs supprimés.
- `CLAUDE.md` (atelier) — `APP_URL` listé comme auto-injecté.
- `contentos/CLAUDE.md` — `APP_URL` retiré de la liste des secrets.

---

## Task 1 : injecter APP_URL dans deploy.sh

**Files:**
- Modify: `scripts/deploy.sh` (après le bloc secrets `age`, lignes ~90-93)

- [ ] **Step 1 : ajouter l'injection après les secrets**

Juste après le bloc qui déchiffre `global.env.age` / `${PROJ}.env.age` (la ligne
`fi` qui ferme `if [ -f /opt/lab/secrets-key ]`), insérer :

```sh
# Origine publique du déploiement : primitive générique connue de la plateforme seule
# (elle attribue le host). Écrite APRÈS les secrets pour être autoritative — en --env-file
# la dernière occurrence d'une clé gagne, donc un secret périmé ne peut pas la masquer.
printf 'APP_URL=https://%s\n' "$HOST" >> "$APPDIR/.env"
```

- [ ] **Step 2 : vérifier la syntaxe**

Run: `bash -n scripts/deploy.sh`
Expected: aucune sortie (syntaxe OK).

- [ ] **Step 3 : simuler l'ordre des clés**

Run (vérifie qu'APP_URL est bien injecté et gagne contre une valeur antérieure) :
```bash
APPDIR=$(mktemp -d); HOST=contentos-ma-branche.lab.avqn.ch
printf 'APP_URL=https://stale.example\n' > "$APPDIR/.env"   # simule un secret périmé
printf 'APP_URL=https://%s\n' "$HOST" >> "$APPDIR/.env"
# docker/dotenv : dernière clé gagne
tail -n1 "$APPDIR/.env"; rm -rf "$APPDIR"
```
Expected: `APP_URL=https://contentos-ma-branche.lab.avqn.ch`

- [ ] **Step 4 : commit**

```bash
git add scripts/deploy.sh
git commit -m "$(cat <<'EOF'
✨ deploy : injecte APP_URL=https://<host> par env (primitive plateforme)

L'origine publique est connue de la plateforme seule ; injectée après les
secrets pour être autoritative. Corrige l'APP_URL faux des previews.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : réduire les e2e au smoke auth

**Files:**
- Delete: les 14 specs e2e listés ci-dessous
- Keep: `contentos/test/e2e/auth.spec.ts`, `contentos/test/e2e/global-setup.ts`

- [ ] **Step 1 : supprimer les 14 specs**

```bash
cd contentos
git rm test/e2e/calendar.spec.ts test/e2e/carousel-video.spec.ts test/e2e/ideas.spec.ts \
  test/e2e/image-edit.spec.ts test/e2e/linkedin-connection.spec.ts test/e2e/linkedin-publish.spec.ts \
  test/e2e/media-gallery.spec.ts test/e2e/post-image.spec.ts test/e2e/post-visual.spec.ts \
  test/e2e/posts.spec.ts test/e2e/settings-brand.spec.ts test/e2e/settings-editorial.spec.ts \
  test/e2e/template-image-var.spec.ts test/e2e/visual-templates.spec.ts
cd ..
```

- [ ] **Step 2 : vérifier que Playwright ne voit plus qu'un spec**

Run: `cd contentos && npx playwright test --list`
Expected: liste ne contenant que des tests de `auth.spec.ts` (1 fichier). `--list` n'exige
ni base ni serveur.

- [ ] **Step 3 : commit**

```bash
git commit -m "$(cat <<'EOF'
🔥 contentos : réduit les e2e au smoke auth (boot + login + garde)

La logique métier est couverte par les tests d'intégration ; on garde un seul
parcours bout-en-bout pour le câblage critique.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : gate CI dans deploy.yml

**Files:**
- Modify: `.github/workflows/deploy.yml` (ajouter le job `test` ; `deploy.needs` = `[detect, test]`)

- [ ] **Step 1 : insérer le job `test` entre `detect` et `deploy`**

Insérer ce job juste avant `  deploy:` :

```yaml
  test:
    needs: detect
    if: needs.detect.outputs.projects != '' && needs.detect.outputs.projects != '[]'
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        project: ${{ fromJson(needs.detect.outputs.projects) }}
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U app" --health-interval 5s
          --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping" --health-interval 5s
          --health-timeout 5s --health-retries 10
    defaults:
      run:
        working-directory: ${{ matrix.project }}
    env:
      # Variables requises par src/lib/env.ts (vitest, build, serveur e2e).
      # .env.test (committé) force DATABASE_URL sur la base de test localhost.
      APP_URL: http://localhost:3000
      REDIS_URL: redis://localhost:6379
      BETTER_AUTH_SECRET: ci-placeholder-secret-ci-placeholder
      DATABASE_URL: postgres://app:app@localhost:5432/contentos_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: ${{ matrix.project }}/package-lock.json
      - name: Install deps
        run: npm ci
      - name: Prepare test DB (si lab.json déclare db)
        run: |
          if [ -f lab.json ] && [ "$(jq -r '.db // false' lab.json)" = "true" ]; then
            npm run db:test:prepare
          else
            echo "pas de db déclarée — skip"
          fi
      - name: Unit + integration + worker
        run: npm test --if-present
      - name: Build (requis pour le smoke e2e)
        run: npm run build --if-present
      - name: Smoke e2e (si playwright configuré)
        run: |
          if [ -f playwright.config.ts ]; then
            npx playwright install --with-deps chromium
            npm run test:e2e
          else
            echo "pas d'e2e — skip"
          fi
```

- [ ] **Step 2 : faire dépendre `deploy` du gate**

Dans le job `deploy`, remplacer `    needs: detect` par :

```yaml
    needs: [detect, test]
```

Le `if` du job `deploy` reste inchangé (`needs.detect.outputs.projects` reste accessible) ; son
`success()` implicite saute le déploiement si `test` échoue.

- [ ] **Step 3 : valider le YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml ok')"`
Expected: `yaml ok`

Run (si `actionlint` dispo) : `command -v actionlint && actionlint .github/workflows/deploy.yml || echo "actionlint absent — skip"`
Expected: aucune erreur, ou skip.

- [ ] **Step 4 : commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "$(cat <<'EOF'
✨ ci : gate de tests (unit+integration+worker+smoke) avant deploy

Job test générique par projet changé : services Postgres/Redis, prépa de la
base de test selon lab.json, npm test + smoke e2e. deploy dépend de test.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : docs (instantané de l'état cible)

**Files:**
- Modify: `CLAUDE.md` (atelier, § Données — lab.json)
- Modify: `contentos/CLAUDE.md` (§ Données & secrets)

- [ ] **Step 1 : atelier CLAUDE.md — APP_URL auto-injecté**

Dans la section « Données — `lab.json` » de `CLAUDE.md` (racine), ajouter à la liste des variables
auto-fournies que la plateforme injecte `APP_URL` = l'origine publique du déploiement
(`https://<projet>-<env>.lab.avqn.ch` en preview, `https://<projet>.lab.avqn.ch` en prod lab),
au même titre que `DATABASE_URL`. Reformuler la phrase existante sur les variables auto-fournies
pour l'inclure (état cible, sans cadrage par contraste).

- [ ] **Step 2 : contentos CLAUDE.md — APP_URL hors secrets**

Dans `contentos/CLAUDE.md` (§ Données & secrets) : retirer `APP_URL` de la liste des secrets de
`/opt/lab/secrets/contentos.env` et préciser, là où sont décrites les variables auto-injectées,
qu'`APP_URL` est fourni par la plateforme = l'origine déployée. Mettre à jour le passage
« L'URL publique du MCP/OAuth doit correspondre… » pour refléter que l'alignement est automatique.
Garder le commentaire `<!-- go-live: APP_URL → contentos.avqn.ch -->` (prod réelle hors dépôt).

- [ ] **Step 3 : relecture**

Run: `git diff -- CLAUDE.md contentos/CLAUDE.md`
Expected: APP_URL apparaît comme auto-injecté côté atelier, et n'apparaît plus comme secret à poser
côté contentos. Aucun cadrage par contraste (« désormais », « au lieu de »).

- [ ] **Step 4 : commit**

```bash
git add CLAUDE.md contentos/CLAUDE.md
git commit -m "$(cat <<'EOF'
📝 docs : APP_URL = primitive auto-injectée par la plateforme

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (couverture du spec)

- APP_URL injecté après secrets, autoritatif → Task 1. ✓
- APP_URL retiré du secret → hors-scope (local `/lab-secret`), rappelé en docs Task 4. ✓
- e2e réduit au smoke `auth` → Task 2. ✓
- Gate CI générique lisant lab.json, deploy dépend de test → Task 3. ✓
- Docs (atelier + contentos) → Task 4. ✓
- Découpage : tout sur la branche, commits gitmoji + Co-Authored-By. ✓

Validation finale réelle (non automatisable ici) : pousser la branche → la preview
`contentos-<branche>.lab.avqn.ch` doit servir le bon `APP_URL` et le gate CI doit passer.
