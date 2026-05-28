# Ressources

Plateforme de ressources (lead magnets) pour communauté LinkedIn, pilotée par API + MCP.

Une ressource est une arborescence de pages composées de modules typés, servie sur `/r/<slug>`
via un reader SSR brutaliste éditorial (noir & blanc + accent vermillon, ombres portées). L'accès
est gaté par code OTP email (chaque accès remplit la bibliothèque du visiteur). Les ressources se
créent et s'éditent depuis un agent IA via le serveur MCP. Voir `docs/superpowers/specs/` et
`docs/superpowers/plans/`.

## Dev local

```bash
npm install
cp .env.example .env.local
docker compose up -d        # Postgres local
npm run db:push             # crée les tables
npm run db:seed             # ressource de démo
npm run dev                 # http://localhost:3000/r/guide-ia
```

## Tests & qualité

```bash
npm test            # logique pure (arbre, sommaire, résolution, validation modules)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

## Pilotage par IA (MCP)

Serveur MCP streamable sur `/api/mcp`, en **OAuth** (better-auth) réservé aux comptes admin —
aucune clé statique. 19 outils : `list_resources`, `get_resource`, `get_outline`, `get_stats`,
`create_resource` (crée une ressource complète et renvoie son URL), `update_resource`,
`delete_resource`, `add/update/delete/move_page`, `reorder_pages`, `add_modules`,
`add/update/delete/reorder_module(s)`, `grant/revoke_access`.

Brancher **Claude.ai / Claude Code** : ajouter le connecteur sur `https://<domaine>/api/mcp` et
autoriser via le flux OAuth (connexion OTP + page de consentement).

Vérifier en local (serveur lancé) :

```bash
node --env-file=.env.local --import tsx scripts/mcp-smoke.ts
```

## Console d'administration

Zone `/admin` réservée aux comptes admin : tableau de bord (stats), gestion des ressources
(publier, featured, visibilité, supprimer), attribution des ressources privées par email,
builder par formulaires (arbre de pages + modules, réordonnancement ↑↓).

Pour devenir admin : se connecter une fois (OTP) puis se promouvoir.

```bash
npm run db:make-admin -- ton@email.com
```

## Déploiement Coolify

- Prod : https://ressources.avqn.ch — **déployer = `git push origin main`** (auto-deploy Coolify).
- Observer / diagnostiquer : `scripts/deploy.sh` (cf. skill `deploy`) ou Coolify → Deployments.
- Build via le `Dockerfile` (sortie Next standalone), port 3000, `DATABASE_URL` en variable d'env.
- Changement de schéma : l'image standalone n'a pas `drizzle-kit` → appliquer depuis le poste
  avant le push (`DATABASE_URL=<prod> npx drizzle-kit migrate`). Détails : `docs/DEPLOY.md`.

## Stack

Next.js 16 (App Router) · Drizzle ORM + Postgres · better-auth (OTP email) · Resend ·
MCP (@modelcontextprotocol/sdk + mcp-handler) · Zod · Tailwind v4 + Geist ·
react-markdown (GFM, sanitize, slug) · Vitest.
