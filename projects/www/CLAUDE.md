# www — page d'accueil de contentos.ch

App **Next.js** servie sur **`contentos.ch`** et **`www.contentos.ch`** (deux hosts mappés sur
la même route Caddy par `deploy.sh`, cas spécial pour `www`).

- **`/`** — landing publique : pitch de la suite contentos (outils pilotés par des agents IA).
- **`/dashboard`** — raccourcis vers les outils (media, ressources, cast, skills), **gardé par
  le SSO** (`auth.contentos.ch`). Hors-prod (preview + local), accès ouvert (court-circuit).
- **`/healthz`** — 200, ne touche aucune ressource.

## Stack

- Next.js 16 App Router, sortie `standalone`, écoute `:8080`. Calque `styleguide`.
- **`@contentos/ui`** : composants copiés via `bin/ui-sync www` (ne pas éditer `src/components/ui/*`
  ni `src/lib/utils.ts` — modifier `packages/ui` puis resync).
- Auth déléguée au SSO (`src/lib/auth.ts`, modèle `skills`). Pas de base, pas d'email.

## Liste du dashboard — `bin/www-tools-sync`

Le build Docker est scopé par projet : `www` ne lit pas les autres `lab.json`. La liste des
raccourcis est donc **matérialisée** dans `src/tools.generated.json` par `bin/www-tools-sync`,
qui scanne les blocs `dashboard` opt-in déclarés dans `projects/*/lab.json` :

```json
"dashboard": { "label": "media", "tagline": "Génération et édition de visuels", "order": 10 }
```

- `bin/www-tools-sync` — (re)génère `src/tools.generated.json` (ne pas l'éditer à la main).
- `bin/www-tools-sync --check` — garde-fou CI (job `www_tools_guard`), échoue sur dérive.

Pour ajouter/retirer un outil : éditer le bloc `dashboard` du `lab.json` concerné, relancer
`bin/www-tools-sync`, committer.

## Déployer

Push de branche → preview `https://www-<branche>.preview.contentos.ch`. Merge → prod sur
`https://contentos.ch` + `https://www.contentos.ch`. Jamais de commit sur `main`.
