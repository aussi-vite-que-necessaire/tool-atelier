# media — service média de l'atelier

Centre des médias de la suite de contenu : **génération/édition d'image** (Gemini), **rendu
HTML→image** (Chromium partagé), **templates visuels** (Handlebars + variables typées + marque),
**styles de génération**, **chartes graphiques**, **construction de PDF** (agrégation d'images) et
**upload** d'image/PDF/vidéo. Le tout stocké sur R2 + métadonnées Postgres, et exposé par **trois
interfaces** — un serveur **MCP** (connecteur claude.ai), une **API `/v1`** service-to-service, et
un **front-end d'admin** (derrière le login). Prod : `https://media.lab.avqn.ch`.

**Conceptions** : `docs/superpowers/specs/2026-05-27-media-import-design.md` (socle v1) et
`docs/superpowers/specs/2026-05-27-media-migration-contentos-design.md` (centre des médias).
**Plan** : `docs/superpowers/plans/2026-05-27-media-migration-contentos.md`.


## Skill agentique

Le skill `creer-un-visuel` (mode d'emploi du service media — générer, éditer, rendre, agréger en PDF) vit dans le hub central de l'atelier : `skills/skills/creer-un-visuel/`. Téléchargeable sur `https://skills.lab.avqn.ch` après connexion OTP.

## Stack

- **Next.js 16** en sortie `standalone` → image Docker slim, écoute `:8080`.
- **Drizzle ORM** (Postgres) : schéma `src/db/schema.ts`, client paresseux `src/db/index.ts`.
- **BetterAuth** : `src/lib/auth.ts` (plugins `mcp()` + `emailOTP()`), routes `app/api/auth/[...all]`.
- **Tailwind 4**.
- **Handlebars** (compilation des templates) + **pdf-lib** (construction de PDF).

## Besoins déclarés (`lab.json`)

- `db: true` → `DATABASE_URL` auto (tables BetterAuth + `media`, `visual_styles`, `style_guides`, `visual_templates`, `brand`).
- `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` auto (connexion par code OTP). Sans clé Resend (dev/test), le code est loggé côté serveur (`[OTP] <email> -> <code>`).
- `browser: true` → `BROWSER_URL` auto (Chromium partagé browserless, réseau `lab`).

`migrate` (`node scripts/migrate.mjs`) applique les migrations `drizzle/` avant le démarrage.
Faire évoluer le schéma : éditer `src/db/schema.ts` → `npm run db:generate` → committer.

## Interfaces

- **MCP** `/api/mcp` (via `mcp-handler` + `@modelcontextprotocol/sdk`, outils dans `src/lib/mcp/tools/`) :
  - Médias : `generate_image` (+ `style_id`), `edit_image`, `render_html`, `render_template`,
    `create_pdf`, `list_images`, `get_image`, `delete_image`.
  - Styles : `list_visual_styles`, `create_visual_style`, `update_visual_style`, `delete_visual_style`.
  - Chartes : `list_style_guides`, `get_style_guide`, `create_style_guide`, `update_style_guide`, `delete_style_guide`.
  - Templates : `list_visual_templates`, `get_visual_template`, `create_visual_template`, `update_visual_template`, `delete_visual_template`.
  - Marque : `get_brand`, `update_brand`.
- **`/v1`** (Bearer `MEDIA_ENGINE_SERVICE_KEY`) — `POST /v1/generate` (+ `styleId`), `/v1/edit`,
  `/v1/render-html`, `/v1/render-template`, `/v1/pdf`, `/v1/upload`, `DELETE /v1/object/:id`.
- **Admin** (App Router, route group `(admin)`, derrière le login magic-link) : `/gallery`
  (galerie + upload manuel), `/templates` (+ éditeur avec aperçu de rendu), `/styles`,
  `/style-guides`, `/brand`.

Le rendu de template substitue les variables côté serveur (Handlebars + contexte `{{brand.*}}`) ;
`render_html` reste le chemin sans templating (l'appelant fournit tout le HTML).

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
- `npm test` — vitest (logique pure : dsl, compile, pdf, validation, store…).
- `npm run db:generate` — nouvelle migration Drizzle depuis le schéma.
