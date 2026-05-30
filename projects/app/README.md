# content-os

SaaS d'aide à la création de contenu éditorial pour LinkedIn, piloté par IA. Une instance par créateur, auto-hébergeable.

## Stack

- **Framework** : Next.js 16 (App Router) + TypeScript strict
- **DB** : Postgres 16 + Drizzle ORM
- **Auth** : Better-Auth (magic link via Resend)
- **Queue** : BullMQ (Redis)
- **Storage** : Cloudflare R2 (S3-compatible, swappable)
- **UI** : Tailwind v4 + shadcn/ui
- **Tests** : Vitest + Playwright
- **Lint** : Biome
- **Conteneurs** : Docker Compose (dev), à compléter pour prod

## Pré-requis

- Node 22+
- Docker Desktop
- Un compte Resend ([resend.com](https://resend.com)) pour les emails de connexion en prod
  - Pas obligatoire en dev : sans `RESEND_API_KEY`, les emails atterrissent dans un buffer in-memory (testable via `/api/__test__/emails` en `E2E_TESTING=true`)
- Un bucket Cloudflare R2 pour le storage en prod
  - Pas obligatoire en dev : sans `R2_ACCOUNT_ID`, un storage in-memory est utilisé
- Une clé Anthropic (`ANTHROPIC_API_KEY`) pour la génération de posts via le worker
  - Pas obligatoire en dev/tests : `CONTENT_OS_AI_STUB=1` court-circuite Claude et renvoie un post stub

## Setup local

```bash
git clone git@github.com:ManuAVQN/content-os-v2.git
cd content-os-v2
npm install

# Variables d'env
cp .env.example .env
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
# Optionnel : remplir RESEND_API_KEY + R2_* dans .env si tu veux tester en réel

# Services de dev
docker compose up -d

# Migrations
npm run db:migrate

# Démarrer Next.js (terminal 1)
npm run dev

# Démarrer le worker (terminal 2)
npm run worker
```

Ou tout en un avec :

```bash
npm run dev:all
```

Ouvrir [http://localhost:3000](http://localhost:3000) → page de signin. Saisir un email → cliquer le lien magique reçu dans la console (ou dans Resend si configuré).

## Tests

```bash
npm run lint              # Biome
npm run test:unit         # Vitest (hermétique, pas de services requis)
npm run test:integration  # Vitest + Postgres
npm run test:worker       # Vitest + Postgres + Redis
npm test                  # Tout sauf E2E (unit + integration + worker)

# E2E : build prod requis avant
npm run build
npm run test:e2e          # Playwright + stack complète
```

## Scripts utiles

```bash
npm run db:generate     # générer une nouvelle migration depuis le schema Drizzle
npm run db:migrate      # appliquer les migrations en attente
npm run db:studio       # ouvrir Drizzle Studio (GUI DB) sur :4983
npm run format          # auto-format Biome

# Seed les 2 templates visuels LinkedIn portés depuis v1 dans un compte
# (idempotent : skip si déjà présent). Récupère le USER_ID via Drizzle Studio
# ou psql.
npx tsx --env-file=.env scripts/seed-visual-templates.ts <USER_ID>
```

## Architecture

Voir `docs/architecture.md` (à venir).

## Déploiement

À documenter en Spec 8 (polish + observability + déploiement). Cible : Docker Compose prod avec services `web` + `worker` + `postgres` + `redis`, derrière Caddy/Traefik/Coolify pour TLS.

## Contribution

- Branches : `feat/*`, `fix/*`, `chore/*`
- Commits : messages descriptifs avec emoji `🤖` quand co-écrit avec Claude
- PR template : à créer
- CI doit être verte avant merge

## Licence

À définir.
