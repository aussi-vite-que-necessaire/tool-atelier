# Gate CI rapide — plan d'implémentation

**Goal :** réduire la latence du pipeline via le parallélisme (build ∥ test) et un deploy qui ne
fait que *pull*. Voir `ci-fast-gate-design.md`.

### Tâche 1 — Refonte `.github/workflows/deploy.yml`

- **Concurrence** : `group: deploy-${{ github.event_name }}-${{ github.ref }}`,
  `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`.
- **detect** : ajouter une sortie `env` (prod sur main, slug sinon).
- **build** (needs detect, matrice) : `docker/setup-buildx-action` + `docker/login-action` +
  `docker/build-push-action` (`context: <projet>`, `push: true`,
  `tags: ghcr.io/<owner>/atelier-<projet>:<env>`, `cache-from/to: type=gha,scope=<projet>`).
- **test** (needs detect, matrice, services postgres+redis) : `npm ci` + `db:test:prepare` +
  `npm test` + `npm run build` + cache `~/.cache/ms-playwright` + smoke e2e (inchangé).
- **deploy** (needs [detect, build, test], matrice) : retirer le `Build + push` ; garder le SCP +
  `ssh deploy.sh <proj> <env> <image>` (deploy.sh fait le `docker pull`). Ajouter un step résumé
  qui écrit l'URL dans `$GITHUB_STEP_SUMMARY`.
- **teardown** : inchangé.

### Tâche 2 — Validation locale puis CI

- Valider la syntaxe YAML.
- Pousser `work/ci-fast-gate` (un changement `contentos/` déclenche `detect`).
- `gh run watch` : vérifier build∥test→deploy verts, mesurer les durées par job (cache froid puis
  chaud), vérifier la preview (auto-login OTP).

### Tâche 3 — Prod + rapport

- Ouvrir la PR, merge en `main`, watch le deploy prod, vérifier `contentos.avqn.ch`.
- Comparer les temps avant/après (cache chaud) → rapport.
- Nettoyage : branche distante (teardown preview) + worktree.
