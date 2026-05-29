# docs

Espace **public** de lecture des ressources contentos (`https://docs.contentos.ch`).

Sert les espaces opérateur (`/o/<handle>`), le reader SSR brutaliste des ressources
(`/o/<handle>/r/<slug>`), et les pages lecteur (`/bibliotheque`, `/compte`). L'**admin**
(édition, MCP, stats, login opérateur) vit dans le projet voisin **`ressources`**.

`docs` partage **la même base** que `ressources` (lab.json : `db.shared`). Il ne possède pas le
schéma — `db/schema` + `db/index.ts` sont une copie générée par `../../scripts/sync-shared.sh`,
vérifiée en CI. Tout le détail dans `CLAUDE.md`.

## Dev local

```bash
scripts/dev-db.sh up ressources   # base partagée (créée + migrée par ressources)
scripts/dev-db.sh up docs         # .env de docs pointé sur ressources_dev
npm run dev                       # http://localhost:3000
```

## Tests & qualité

```bash
npm test            # logique pure (arbre, sommaire, résolution, validation modules, tracking)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Stack

Next.js 16 (App Router) · Drizzle ORM + Postgres (lecture) · SSO better-auth délégué
(auth.contentos.ch) · Zod · Tailwind v4 + Geist · react-markdown (GFM, sanitize, slug) ·
Shiki · Vitest.
