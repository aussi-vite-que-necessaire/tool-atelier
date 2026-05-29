# mcp

passerelle MCP centrale (mcp.contentos.ch) — fédère les tools de la suite.

Projet généré par `/lab-new` (base Next.js App Router + Tailwind 4, sortie `standalone`).
Point de départ **déviable** : tout est modifiable. Les capacités cochées au démarrage
(base de données, Redis, auth, MCP) ont été composées depuis `starters/modules/`.

## Repères

- `src/app/` — routes (App Router). `globals.css` porte le bloc `@theme` (tokens de design).
- `healthz/route.ts` — `GET /healthz` → 200, ne touche aucune ressource.
- `Dockerfile` / `compose.yml` — build CI uniquement ; le serveur *pull* l'image (jamais de build).
- `lab.json` — capacités déclarées (db/redis/email/mcp) ; la plateforme injecte les variables
  (`DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `APP_URL`).

## Dev (agents & local)

`scripts/dev-db.sh up mcp` (depuis la racine de l'atelier) monte les bases déclarées
dans `lab.json` — Postgres/Redis en **natif** (sans Docker, OK en session cloud), crée le rôle
`app` + `mcp_dev` et `mcp_test`, joue migrate + seed (dev) et
`db:test:prepare` (test), et écrit `.env` (`DATABASE_URL`, `APP_URL`, `REDIS_URL`,
`BETTER_AUTH_SECRET`). Ensuite `npm run dev` → http://localhost:3000 et `npm test` passent du
premier coup. Idempotent (à relancer si le conteneur a été recyclé). Les **e2e** (Playwright)
ne sont pas couverts ici : ils tournent en CI post-deploy contre la preview.

## Déployer

`git push` sur une branche → preview `https://mcp-<branche>.preview.contentos.ch`.
Merge de la PR → prod `https://mcp.contentos.ch`. Jamais de commit sur `main`.
