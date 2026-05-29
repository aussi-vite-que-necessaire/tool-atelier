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

## Dev (agents & local)

`scripts/dev-db.sh up __PROJECT_NAME__` (depuis la racine de l'atelier) monte les bases déclarées
dans `lab.json` — Postgres/Redis en **natif** (sans Docker, OK en session cloud), crée
`__PROJECT_NAME___dev` et `__PROJECT_NAME___test`, joue migrate + seed et écrit `.env.local`
(`DATABASE_URL`, `APP_URL`…). Ensuite `npm run dev` → http://localhost:3000 ; les tests qui
touchent la base tournent sur `__PROJECT_NAME___test`. Idempotent (à relancer si le conteneur a
été recyclé).

## Déployer

`git push` sur une branche → preview `https://__PROJECT_NAME__-<branche>.preview.contentos.ch`.
Merge de la PR → prod `https://__PROJECT_NAME__.contentos.ch`. Jamais de commit sur `main`.
