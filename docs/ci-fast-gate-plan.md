# Gate CI artefact unique — plan d'implémentation

> Exécution autonome. Validation e2e-conteneur **en local d'abord**, puis push (minimise les itérations CI).

**Goal :** un seul `next build` par push, deploy = pull, ~5,5 min → ~3 min.

---

### Tâche 1 — Mode « serveur externe » Playwright (contentos)

- `contentos/playwright.config.ts` :
  - `const externalBase = process.env.E2E_BASE_URL;`
  - `use.baseURL = externalBase ?? 'http://localhost:3000';`
  - inclure `webServer` **seulement si** `!externalBase` (spread conditionnel).
- `contentos/test/e2e/global-setup.ts` : tout en haut de `globalSetup`, si `process.env.E2E_BASE_URL` → `return async () => {};` (serveur + worker gérés en externe).

Vérif locale : `npm run test:e2e` (sans E2E_BASE_URL) marche toujours (webServer lancé).

### Tâche 2 — Refonte `.github/workflows/deploy.yml`

Conserver `detect` et la matrice par projet. Concurrence :
```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

**Job `build`** (needs detect, matrice) :
- checkout, `docker login ghcr.io`.
- step `vars` : calcule `env` (prod si ref=main, sinon slug) + `image=ghcr.io/<owner>/atelier-<projet>:<env>` (sortie de step).
- `docker/setup-buildx-action`.
- `docker/build-push-action` avec `context: <projet>`, `push: true`, `tags: <image>`, `cache-from: type=gha,scope=<projet>`, `cache-to: type=gha,mode=max,scope=<projet>`.

**Job `test`** (needs detect, matrice, services postgres+redis, env placeholders) :
- checkout, setup-node (cache npm), `npm ci`, `npm run db:test:prepare` (si db), `npm test`.
- **plus de `npm run build` ni e2e ici.**

**Job `e2e`** (needs [detect, build], matrice, services postgres+redis, env placeholders) :
- garde si `playwright.config.ts` présent (sinon skip).
- checkout, setup-node (cache npm), `npm ci`, `npm run db:test:prepare`.
- cache `~/.cache/ms-playwright` (clé = hash du package-lock), `npx playwright install --with-deps chromium`.
- `vars` (même calcul env/image), `docker login`, `docker pull <image>`.
- `docker run -d --network host --name app-web -e PORT=3000 -e E2E_TESTING=true -e RESEND_API_KEY= -e CONTENT_OS_MEDIA_STUB=fs -e CONTENT_OS_LINKEDIN_STUB=1 -e DATABASE_URL=postgres://app:app@localhost:5432/contentos_test -e REDIS_URL=redis://localhost:6379 -e APP_URL=http://localhost:3000 -e BETTER_AUTH_SECRET=ci-placeholder-secret-ci-placeholder <image>`
- `docker run -d --network host --name app-worker <mêmes -e> <image> node worker-runner.mjs`
- attendre `curl -fsS http://localhost:3000/healthz` (boucle, timeout 60s).
- `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`.
- `if: failure()` → `docker logs app-web; docker logs app-worker`.

**Job `deploy`** (needs [detect, build, test, e2e], matrice) :
- comme aujourd'hui MAIS **sans `Build + push`** (l'image existe déjà). Garde `vars`, login pas nécessaire (deploy.sh pull via SSH côté lab), scp deploy.sh/compose/lab.json/secrets, `ssh deploy.sh <proj> <env> <image>`.
- step final : `echo "Déployé : https://… " >> "$GITHUB_STEP_SUMMARY"` (URL selon env).

**Job `teardown`** (event delete) : lui donner un groupe de concurrence propre pour ne pas être annulé :
```yaml
  teardown:
    concurrency:
      group: teardown-${{ github.event.ref }}
      cancel-in-progress: false
```

### Tâche 3 — Validation locale (avant push)

1. `docker build -t atelier-contentos:local contentos` (depuis le worktree).
2. `npm run db:test:prepare` (DATABASE_URL=contentos_test) si pas déjà fait.
3. `docker run -d --network host` web + worker (mêmes env que CI, image `:local`).
4. `curl localhost:3000/healthz` → 200.
5. `E2E_BASE_URL=http://localhost:3000 npm run test:e2e` → vert.
6. Stop conteneurs.

> macOS : `--network host` ne mappe pas pareil que Linux ; si besoin, mapper `-p 3000:8080` et pointer `E2E_BASE_URL=http://localhost:3000`, DATABASE_URL/REDIS_URL via `host.docker.internal`. La CI tourne sous Linux (host network OK) — la validation locale sert surtout à prouver la logique du mode serveur externe.

### Tâche 4 — Validation CI + prod

1. Ajouter un commentaire trivial dans un fichier `contentos/` (exercer `detect`).
2. Commit + push `work/ci-fast-gate`.
3. `gh run watch` : vérifier build→test+e2e→deploy verts, **mesurer les durées par job**.
4. Vérifier la preview déployée par le nouveau flux (auto-login OTP).
5. Ouvrir la PR, merge en prod, watch le deploy prod, vérifier `contentos.avqn.ch`.
6. Comparer les temps avant/après → rapport.

### Tâche 5 — Nettoyage + rapport

- Supprimer branche distante (preview teardown), worktree.
- Rapport : durées avant/après par job + total, gains, optimisations livrées.
