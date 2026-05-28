# contentos — optimisation Docker / CI (PR1)

## Problème

L'image Docker de `contentos` pèse **~2 GB** et le build CI prend **~7 minutes**. Le
serveur lab se remplit vite — on a déjà ajouté un `docker image prune -f` post-déploiement
(commit `d4e3cb1`) mais ça ne traite que le symptôme. Les `hello`/`counter`/`ressources`
ne souffrent pas autant : c'est bien le setup `contentos` qui est en cause.

## Cause racine identifiée

1. **Base `node:22-slim`** (~350 MB) au lieu de `node:22-alpine` (~170 MB), sans raison
   documentée. `ressources/Dockerfile` est déjà sur alpine.
2. **Le runner copie le `node_modules` complet** depuis le stage `deps` (donc devDeps
   inclus : Playwright ~200 MB, Biome ~150 MB, drizzle-kit ~50 MB, vitest, typescript, etc.,
   total ~500 MB de gras). C'est volontaire car **le worker tourne sur la même image** et
   exécute son code TypeScript via `tsx` (devDep).
3. **Aucun cache de couches Docker en CI** (décision explicite, commit `19f3808`, valide
   seulement à froid — nos itérations PR sont quasi toujours chaudes).
4. **Cache `.next/cache` non persisté** entre runs du job `test`.

## Objectif

Diviser image et build par ~3-4×. Cibles indicatives :

| Métrique | Avant | Cible |
| --- | --- | --- |
| Image web | ~2 GB | ~250 MB |
| Image worker | ~2 GB | ~350 MB |
| Build CI (chaud) | ~7 min | ~2 min |

## Approche

**Split en 2 images Docker** (web + worker) via **un seul Dockerfile multi-target**.
C'est le pattern le plus propre — il fait partie de l'évolution structurelle de l'atelier
pour les projets qui ont plusieurs process. Plutôt que de bricoler une « image unique
allégée », on aligne contentos sur ce que sera la norme pour ce genre de cas.

### 1. `contentos/Dockerfile` — multi-stage, multi-target, alpine

Pattern aligné sur `ressources/Dockerfile` (déjà conforme alpine + `proddeps`), étendu
pour deux targets finales :

- `deps` (alpine) — `npm ci` complet (build a besoin des devDeps).
- `build` (alpine) — `next build` → sortie standalone.
- `proddeps` (alpine) — `npm ci --omit=dev` → node_modules de prod uniquement.
- **target `web`** (alpine) — Next standalone + static + public + drizzle + scripts +
  proddeps. CMD `node server.js`. Sert aussi au one-shot `migrate`.
- **target `worker`** (alpine) — src/ + tsconfig + worker-runner.mjs + proddeps.
  CMD `node worker-runner.mjs`. Pas de Next, pas de .next/standalone.

### 2. `contentos/package.json` — `tsx` en `dependencies`

Le worker exécute son code TypeScript via `tsx` au runtime. Pour que `npm ci --omit=dev`
laisse `tsx` dans l'image worker, on le déplace de `devDependencies` vers
`dependencies`. Aucun autre devDep n'est nécessaire au runtime.

> Playwright reste en devDep (sert au smoke e2e d'auth dans le job `test`, pas à de la
> génération média — qui est partie dans `media`). Le split d'image suffit à le sortir
> du runtime.

### 3. `contentos/lab.json` — déclarer les rôles d'images

Ajout d'un champ `images` (tableau de targets Dockerfile à builder) :

```json
{ "images": ["web", "worker"], ... }
```

Convention : si absent, le workflow build une image unique (comportement actuel, autres
projets non affectés). Si présent, build chaque target et push avec un suffixe `-<role>`
au nom de l'image (`atelier-contentos-web`, `atelier-contentos-worker`).

### 4. `contentos/compose.yml` — services pointent vers les images dédiées

Service `app` → `${IMAGE_WEB}`. Service `worker` → `${IMAGE_WORKER}`. Compose conserve
sa structure.

### 5. `.github/workflows/deploy.yml` — buildx + cache GHA + multi-target

- Remplacer `docker build` brut par **`docker/build-push-action@v6`** avec `buildx`,
  `cache-from: type=gha`, `cache-to: type=gha,mode=max`. Sur chemin chaud, les layers
  `npm ci` et `next build` sont réutilisés.
- Si `lab.json` déclare `images: [...]`, boucler sur chaque target (`--target=<role>`)
  et push `ghcr.io/.../atelier-<projet>-<role>:<env>`. Sinon comportement actuel.
- Passer **toutes** les images au job `deploy` (variable `IMAGES` au format
  `role=image,role=image` ou simplement l'image unique).
- Job `test` : ajouter `actions/cache` sur **`.next/cache`** (clé sur lock + sha
  best-effort).

### 6. `scripts/deploy.sh` — accepter une ou plusieurs images

Le 3e argument (aujourd'hui `<image-ref>`) reste compatible :

- Format simple `ghcr.io/...:env` → injecte `IMAGE=<ref>` dans `.env` (comportement
  actuel, autres projets inchangés).
- Format `role=ref,role=ref` (présence d'un `=`) → injecte `IMAGE_WEB=...`,
  `IMAGE_WORKER=...` dans `.env`. Le one-shot `migrate` utilise l'image avec rôle
  `web` (la première par défaut si pas de `web` explicite).

## Hors-scope (PR séparées)

- **PR2** : porter le pattern (alpine + multi-target + proddeps + tsx-en-deps) dans le
  starter `/lab-new` et appliquer à `hello`/`counter`/`media` (les projets sans worker
  resteront en target unique mais profiteront alpine + buildx cache).
- **PR3** : ajouter la stack Astro à `/lab-new`.
- **Plus tard** : stack React Router v7 pour les outils admin légers.

## Critère de succès

- Build CI passe au vert sur la PR.
- Preview `https://contentos-claude-contentos-docker-optim.lab.avqn.ch` répond `200`
  sur `/healthz`.
- Métriques avant/après (image size, build time) chiffrées dans le commentaire de PR.
- Image web sous 300 MB, image worker sous 400 MB, build chaud sous 3 min.
