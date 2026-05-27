# media — service média de l'atelier

Outil média centralisé : **génération/édition d'image** (Gemini), **rendu HTML→image** (Chromium
partagé), stockage + métadonnées, exposés par **deux interfaces** — un serveur **MCP** (connecteur
claude.ai) et une **API `/v1`** service-to-service. Prod : `https://media.lab.avqn.ch`.

**Conception** : `docs/superpowers/specs/2026-05-27-media-import-design.md`.
**Plan d'implémentation** : `docs/superpowers/plans/2026-05-27-media-import.md`.

> État actuel : **scaffold flagship** (Next.js + Drizzle + BetterAuth + Tailwind). L'implémentation
> des capacités média suit le plan ci-dessus, tâche par tâche.

## Stack

- **Next.js 16** en sortie `standalone` → image Docker slim, écoute `:8080`.
- **Drizzle ORM** (Postgres) : schéma `src/db/schema.ts`, client paresseux `src/db/index.ts`.
- **BetterAuth** : `src/lib/auth.ts` (+ plugins `mcp()` + `magicLink()` à câbler), routes `app/api/auth/[...all]`.
- **Tailwind 4**.

## Besoins déclarés (`lab.json`)

- `db: true` → `DATABASE_URL` auto (tables BetterAuth + `images`).
- `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` auto (login magic-link).
- `browser: true` → `BROWSER_URL` auto (Chromium partagé browserless, réseau `lab`).

`migrate` (`node scripts/migrate.mjs`) applique les migrations `drizzle/` avant le démarrage.
Faire évoluer le schéma : éditer `src/db/schema.ts` → `npm run db:generate` → committer.

## Interfaces (cibles)

- **MCP** `/api/mcp` — 6 outils : `generate_image`, `edit_image`, `render_html`, `list_images`,
  `get_image`, `delete_image` (via `mcp-handler` + `@modelcontextprotocol/sdk`).
- **`/v1`** (Bearer `MEDIA_ENGINE_SERVICE_KEY`) — `generate`, `edit`, `render-html`, `upload`,
  `DELETE /v1/object/:id`.

## Secrets (`/lab-secret`, scope `media`)

`BETTER_AUTH_SECRET` (≥ 32 car., `openssl rand -base64 32`), `BETTER_AUTH_URL` (URL publique),
`GEMINI_API_KEY`, identifiants S3 R2 (`R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `R2_PUBLIC_BASE_URL`), `MEDIA_ENGINE_SERVICE_KEY`. Auto-injectés (ne pas gérer à la
main) : `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `BROWSER_URL`.

## Build & déploiement

Build sur la CI uniquement (`docker build` → GHCR → pull sur `lab`). `next build` n'a besoin ni de
`DATABASE_URL` ni de `BETTER_AUTH_SECRET` (lecture paresseuse au runtime). `git push` sur une
branche → preview `https://media-<branche>.lab.avqn.ch` ; merge de la PR → prod. **Jamais de commit
sur `main`.**

## Commandes

- `npm run dev` — dev local.
- `npm run build` — build Next standalone.
- `npm test` — vitest (à ajouter avec l'implémentation).
- `npm run db:generate` — nouvelle migration Drizzle depuis le schéma.
