# media — service média de l'atelier

Centre des médias de la suite de contenu : **génération/édition d'image** (Gemini), **rendu
HTML→image** (Chromium partagé), **templates visuels** (Handlebars + variables typées + marque),
**styles de génération**, **chartes graphiques**, **construction de PDF** (agrégation d'images) et
**upload** d'image/PDF/vidéo. Le tout stocké sur R2 + métadonnées Postgres, isolé par utilisateur,
et exposé par **trois interfaces** — un **endpoint de tools interne** (`/internal/tools`, consommé
par la passerelle MCP centrale `mcp.contentos.ch`), une **API `/v1`** service-to-service, et un
**front-end d'admin** (derrière le SSO). Prod : `https://media.contentos.ch`.

**Conceptions** : `docs/superpowers/specs/2026-05-27-media-import-design.md` (socle v1) et
`docs/superpowers/specs/2026-05-27-media-migration-contentos-design.md` (centre des médias).
**Plan** : `docs/superpowers/plans/2026-05-27-media-migration-contentos.md`.


## Skill agentique

Le skill `creer-un-visuel` (mode d'emploi du service media — générer, éditer, rendre, agréger en PDF) vit dans le hub central de l'atelier : `skills/skills/creer-un-visuel/`. Téléchargeable sur `https://skills.contentos.ch` après connexion OTP.

## Stack

- **Next.js 16** en sortie `standalone` → image Docker slim, écoute `:8080`.
- **Drizzle ORM** (Postgres) : schéma `src/db/schema.ts`, client paresseux `src/db/index.ts`.
- Sessions web déléguées à **`auth.contentos.ch`** (cookie cross-subdomain `.contentos.ch`) —
  `src/lib/session.ts` lit la session via fetch HTTP. `src/middleware.ts` filtre l'accès aux
  pages d'admin sur présence du cookie (le SSO revalide ensuite). L'authentification MCP (OAuth)
  est centralisée à la passerelle `mcp.contentos.ch` ; media n'expose que des endpoints internes
  protégés par service-key (`/internal`, `/v1`).
- **Tailwind 4**.
- **Handlebars** (compilation des templates) + **pdf-lib** (construction de PDF).

## Isolation par utilisateur

Toutes les données métier portent un `user_id` (id retourné par le SSO) :
- 5 tables : `media`, `visual_styles`, `style_guides`, `visual_templates`, `brand`.
- `brand` est 1-par-utilisateur (PK = `user_id`).
- `visual_templates.slug` est unique par utilisateur (`(user_id, slug)` unique).
- Toutes les requêtes filtrent par `user_id` (cf. `src/lib/{media,styles,style-guides,templates,brand}/repository.ts`).

## Besoins déclarés (`lab.json`)

- `db: true` → `DATABASE_URL` auto (tables `media`, `visual_styles`, `style_guides`, `visual_templates`, `brand`).
- `browser: true` → `BROWSER_URL` auto (Chromium partagé browserless, réseau `lab`).

`migrate` (`node scripts/migrate.mjs`) applique les migrations `drizzle/` avant le démarrage.
Faire évoluer le schéma : éditer `src/db/schema.ts` → `npm run db:generate` → committer.

## Interfaces

- **Endpoint de tools interne** `/internal/tools` (service-key `MEDIA_ENGINE_SERVICE_KEY`) :
  `GET /internal/tools` renvoie les schémas JSON des tools, `POST /internal/tools/:name` exécute
  un tool avec `{ userId, args }`. Les tools sont déclarés en `ToolDef` dans `src/lib/mcp/tools/`
  et agrégés par `src/lib/mcp/registry.ts` ; chacun reçoit le `userId` transmis par la passerelle.
  La passerelle `mcp.contentos.ch` consomme ce contrat et fédère ces tools sous des noms préfixés.
  - Médias : `generate_image` (+ `style_id`), `edit_image`, `render_html`, `render_template`,
    `create_pdf`, `list_images`, `get_image`, `delete_image`.
  - Styles : `list_visual_styles`, `create_visual_style`, `update_visual_style`, `delete_visual_style`.
  - Chartes : `list_style_guides`, `get_style_guide`, `create_style_guide`, `update_style_guide`, `delete_style_guide`.
  - Templates : `list_visual_templates`, `get_visual_template`, `create_visual_template`, `update_visual_template`, `delete_visual_template`.
  - Marque : `get_brand`, `update_brand`.
- **`/v1`** (Bearer `MEDIA_ENGINE_SERVICE_KEY` + `userId` requis dans le corps JSON ou la query) :
  `POST /v1/generate` (+ `styleId`), `/v1/edit`, `/v1/render-html`, `/v1/render-template`,
  `/v1/pdf`, `/v1/upload` (`?userId=`), `GET /v1/media` (`?userId=`), `GET /v1/media/:id` (`?userId=`),
  `DELETE /v1/object/:id` (`?userId=`).
- **Admin** (App Router, route group `(admin)`, derrière le SSO via `requireUserId()`) : `/gallery`
  (galerie + upload manuel), `/templates` (+ éditeur avec aperçu de rendu), `/styles`,
  `/style-guides`, `/brand`.

Le rendu de template substitue les variables côté serveur (Handlebars + contexte `{{brand.*}}`) ;
`render_html` reste le chemin sans templating (l'appelant fournit tout le HTML).

## Secrets (`/lab-secret`, scope `media`)

- `AUTH_URL` — URL du provider d'auth de la suite (défaut `https://auth.contentos.ch`).
- `GEMINI_API_KEY` — clé Gemini.
- `MEDIA_ENGINE_SERVICE_KEY` — Bearer des endpoints internes (`/internal`, `/v1`).
- Identifiants S3 R2 : `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.

Auto-injectés (ne pas gérer à la main) : `APP_URL`, `DATABASE_URL`, `BROWSER_URL`.

## Build & déploiement

Build sur la CI uniquement (`docker build` → GHCR → pull sur `lab`). `next build` n'a besoin
d'aucune variable d'env (lecture paresseuse au runtime). `git push` sur une branche → preview
`https://media-<branche>.preview.contentos.ch` ; merge de la PR → prod. **Jamais de commit
sur `main`.**

## Commandes

- `npm run dev` — dev local.
- `npm run build` — build Next standalone.
- `npm test` — vitest (logique pure : dsl, compile, pdf, validation, store…).
- `npm run db:generate` — nouvelle migration Drizzle depuis le schéma.
