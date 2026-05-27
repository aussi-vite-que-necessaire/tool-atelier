# __PROJECT_NAME__

__DESCRIPTION__

Projet généré par `/lab-new` (base Next.js App Router + Tailwind 4, sortie `standalone`).
Point de départ **déviable** : tout est modifiable. Les capacités cochées au démarrage
(base de données, Redis, auth, MCP) ont été composées depuis `starters/modules/`.

## Repères

- `src/app/` — routes (App Router). `globals.css` porte le bloc `@theme` (tokens de design).
- `healthz/route.ts` — `GET /healthz` → 200, ne touche aucune ressource.
- `Dockerfile` / `compose.yml` — build CI uniquement ; le serveur *pull* l'image (jamais de build).
- `lab.json` — capacités déclarées (db/redis/email/mcp) ; la plateforme injecte les variables
  (`DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `APP_URL`).

## Déployer

`git push` sur une branche → preview `https://__PROJECT_NAME__-<branche>.lab.avqn.ch`.
Merge de la PR → prod `https://__PROJECT_NAME__.lab.avqn.ch`. Jamais de commit sur `main`.
