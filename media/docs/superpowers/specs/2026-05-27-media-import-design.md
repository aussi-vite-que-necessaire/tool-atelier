# Import de `media` dans l'atelier — design (v1)

- **Date** : 2026-05-27
- **Statut** : validé (brainstorming), à transformer en plan d'implémentation
- **Projet** : `media` (atelier)
- **Source de référence** : `~/Code/media-manager` (package `image-studio`, connecteur claude.ai « AVQN Media Studio »), aujourd'hui déployé sur Cloudflare Workers.

## 1. Objectif

Rapatrier « Image Studio » dans l'atelier sous le projet **`media`**, **iso-fonctionnel** avec
l'existant, en stack atelier (Node/Docker sur le serveur lab) et hors runtime Cloudflare.
`media` devient le premier consommateur d'une **brique Chromium partagée** sur la plateforme.

C'est le premier incrément d'une vision plus large (outil média centralisé). Les incréments
suivants — vidéo, PDF, frontend d'admin, catalogage/labellisation enrichie — sont **hors
périmètre v1** et feront chacun l'objet de leur propre spec.

## 2. Périmètre

**Dans la v1** : génération/édition d'image (Gemini), rendu HTML→image, upload direct,
list/get/delete, métadonnées (prompt, parent, source, tags, dimensions). Les **deux interfaces**
existantes : serveur **MCP** (connecteur claude.ai) et **API `/v1`** service-to-service.

**Hors v1** : vidéo (upload + génération IA tierce), génération PDF (html→pdf, agrégation
d'images), frontend d'administration, catalogage/labellisation avancés.

## 3. Décisions d'architecture

| Sujet | Décision | Raison courte |
|---|---|---|
| Chromium | **browserless partagé** sur le réseau `lab`, injecté via `browser: true` | Un seul Chromium pour tous les projets ; calque le modèle Postgres/Redis |
| Stockage fichiers | **R2 existant** conservé, accès via API **S3** | Aucune migration ; octets hors du serveur ; swappable plus tard (S3) |
| Base | **Postgres** central (`db: true`) | Remplace D1 ; déjà fourni par la plateforme |
| Interfaces/auth | **Next.js + BetterAuth** (plugins `mcp()` + `magicLink()`) | OAuth 2.1 requis par claude.ai ; pattern déjà éprouvé (contentos, ressources) |
| Brique MCP | **promue en `starters/mcp`** en fin de v1 | Capitalise le delta « flagship → connecteur » sans migrer contentos/ressources |

## 4. Architecture cible

`media` est **une app Next.js** (App Router) issue du starter `flagship`, déployée comme tout
projet atelier : elle écoute `:8080`, Caddy route `media.lab.avqn.ch` vers elle. Elle joint le
réseau `lab` et s'appuie sur quatre dépendances fournies par la plateforme :

| Dépendance | Fourniture |
|---|---|
| Postgres | `db: true` → `DATABASE_URL` injecté (tables BetterAuth + `images`) |
| Email (Resend) | `email: true` → `RESEND_API_KEY` + `EMAIL_FROM` (login magic-link) |
| Chromium | `browser: true` → `BROWSER_URL` injecté (nouvelle convention, §5) |
| Stockage | R2, via secrets projet (clé/secret S3, endpoint, bucket, URL publique) |

`lab.json` : `{ "description": "...", "db": true, "email": true, "browser": true, "migrate": "...", "seed": "..." }`.

Pas de worker en v1 : génération et rendu sont synchrones (requête → réponse), browserless gère
la file d'attente et la concurrence du rendu.

## 5. Brique Chromium partagée

Deux moitiés nettement séparées.

**Côté plateforme (hors atelier — prérequis).** Un conteneur **browserless** (`browserless/chromium`)
tourne sur le réseau `lab`, alias `browser`, exposant un endpoint CDP WebSocket protégé par token.
Il n'est **jamais** exposé via Caddy (interne uniquement). Il vit dans `/opt/lab/platform`, géré
hors de l'atelier. **Prérequis à provisionner là-bas avant que le rendu HTML fonctionne.**

**Côté atelier (livrable).** `scripts/deploy.sh` lit `browser: true` dans `lab.json` et injecte
`BROWSER_URL` (ex. `ws://browser:3000?token=…`) dans l'environnement du projet — exactement comme
`db`/`redis`. Convention documentée dans le `CLAUDE.md` racine et la doc `lab.json`.

**Côté `media` (client).** Le rendu utilise `puppeteer-core` :
`puppeteer.connect({ browserWSEndpoint: BROWSER_URL })`. La logique de rendu existante
(`src/lib/browser.ts` de la source : interception de requêtes anti-SSRF, `setViewport`, `setContent`,
`waitFor` sélecteur/délai, screenshot avec `clip`) est **portée telle quelle** ; on remplace
uniquement `puppeteer.launch(env.BROWSER)` par `connect`.

## 6. Composants de `media`

Modules à responsabilité unique, testables isolément.

**Interfaces (routes Next.js)**
- `/api/mcp` — serveur MCP via `mcp-handler` (`createMcpHandler` + `withMcpAuth`), 6 outils.
- `/v1/*` — API service-to-service, auth Bearer (§8).
- `/.well-known/oauth-authorization-server` + `/.well-known/oauth-protected-resource` — découverte OAuth (BetterAuth).
- `/api/auth/[...all]` — BetterAuth. `/sign-in` — page de login (magic-link).

**Logique pure (portée + testée, sans dépendance runtime)** — reprise de la source :
`image-meta` (dimensions PNG/JPEG, mime), `tags`, `base64`, `service-auth`, `url-guard`.

**Adaptateurs runtime**
- `gemini` — `@google/genai`, modèle `gemini-3-pro-image-preview`.
- `render` — `puppeteer-core` connecté à browserless.
- `storage` — client S3 vers R2 (lecture/écriture objets `images/{id}.{ext}`).
- `db` — Drizzle → Postgres.
- `ids` — nanoid (12 caractères).

**Cœur** : `store()` (octets → R2 + insertion ligne `images` + URL publique) est la **source unique
de vérité**, appelée à la fois par les outils MCP et par `/v1`.

## 7. Modèle de données — table `images` (Postgres, Drizzle)

Miroir du schéma D1 d'origine :

| Colonne | Type | Note |
|---|---|---|
| `id` | text PK | nanoid 12 |
| `r2_key` | text | ex. `images/abc123.png` |
| `url` | text | URL publique complète (R2) |
| `prompt` | text null | génération/édition ; null pour `html_render`/`upload` |
| `parent_id` | text null | édition → référence `images.id` |
| `source` | text | `gemini_generate` \| `gemini_edit` \| `html_render` \| `upload` |
| `tags` | jsonb | tableau de tags |
| `width` | int null | |
| `height` | int null | |
| `created_at` | timestamptz | |

Index : `created_at desc`, `parent_id`, `source`. Le type **`jsonb`** permet le filtrage par tag
**en SQL** (la source filtrait en JS faute de type JSON en D1) — petit gain, cette couche étant
réécrite de toute façon.

## 8. Interfaces

### Outils MCP (6)
`generate_image`, `edit_image`, `render_html`, `list_images`, `get_image`, `delete_image`.
Les outils de génération renvoient un content block `image` (base64) **+** des métadonnées texte ;
les autres renvoient du texte. Comportement identique à la source.

### API `/v1` (contrat à préserver à l'identique)
Toutes les routes exigent `Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY>`.
Réponse de création : `{ id, url, width, height }`. Erreur : `{ error }`.

| Méthode | Route | Corps |
|---|---|---|
| POST | `/v1/generate` | `{ prompt, aspectRatio?, stylePrompt? }` |
| POST | `/v1/edit` | `{ sourceId, prompt }` |
| POST | `/v1/render-html` | `{ html, width, height }` |
| POST | `/v1/upload` | corps brut + header `Content-Type` |
| DELETE | `/v1/object/:id` | — → `{ deleted }` |

**Consommateur existant** : `contentos` appelle ces routes via son `HttpMediaEngine`
(`src/lib/media-engine/http.ts`), mais reste branché sur Cloudflare en v1. Le contrat doit rester
identique pour garantir la parité et permettre la migration ultérieure de contentos (§10).

## 9. Authentification & secrets

- **Connecteur claude.ai** : BetterAuth `mcp()` + `magicLink()` (login email, mono-utilisateur).
  OAuth 2.1 complet géré par la lib (découverte, PKCE, enregistrement dynamique, consentement).
  Pattern repris de `contentos/src/lib/auth/server.ts`.
- **API `/v1`** : `Authorization: Bearer <MEDIA_ENGINE_SERVICE_KEY>` — module `service-auth` repris à l'identique.
- **Secrets** (`/lab-secret`, scope `media`) : `GEMINI_API_KEY`, identifiants S3 R2 (access key,
  secret, endpoint, bucket, URL publique), `MEDIA_ENGINE_SERVICE_KEY`, `BETTER_AUTH_SECRET`.
  Les variables auto-fournies (`DATABASE_URL`, `RESEND_API_KEY`, `BROWSER_URL`) ne sont pas gérées à la main.

## 10. Mise en service (v1 : exécution en parallèle)

En v1, `media` à la maison tourne **en parallèle** du Worker Cloudflare existant. On **ne migre
pas contentos** tout de suite : contentos continue d'appeler son `/v1` sur Cloudflare.

1. Déployer `media` en **preview** (branche) et valider iso-fonctionnel (MCP + `/v1`).
2. Prérequis plateforme : browserless provisionné + support `browser: true` dans `deploy.sh`.
3. **Merge PR → prod** `media.lab.avqn.ch`.
4. **Ré-enregistrer le connecteur claude.ai** sur `https://media.lab.avqn.ch/mcp` (le connecteur
   passe à la maison ; le Worker reste joignable mais n'est plus le connecteur enregistré).
5. **Le Worker Cloudflare `image-studio` + D1 restent en service** pour contentos. **R2 conservé** :
   les deux systèmes partagent le bucket (clés nanoid uniques → pas de collision).

**Différé — incrément ultérieur, quand `media` est mûr** : repointer `contentos/MEDIA_ENGINE_URL`
vers la maison (+ même `MEDIA_ENGINE_SERVICE_KEY`), puis décommissionner le Worker + D1. Décider
alors du sort des **métadonnées historiques** (export D1 → Postgres) si le connecteur maison doit
lister l'historique. Le dossier source `~/Code/media-manager` reste la référence d'implémentation.

**Conséquences de l'exécution en parallèle :**

- **Métadonnées** : la table `images` maison **démarre vide** ; l'historique reste en D1 côté
  Worker. Stores distincts mais bucket R2 partagé → `list/get/delete` ne voient que leurs propres
  entrées tant que la fusion n'est pas faite. C'est attendu, pas un bug.
- **Stockage en preview** : pour ne pas polluer le bucket de prod, les environnements **preview**
  de `media` écrivent sous un **préfixe (ou bucket) distinct**, droppé au teardown.

## 11. Promotion en `starters/mcp` (fin de v1)

Une fois `media` fonctionnel, extraire la couche **générique** « connecteur MCP » en
**`starters/mcp`** (= `flagship` + cette couche), sans aucun élément spécifique à `media` :
plugin `mcp()` + `magicLink()` dans `auth.ts`, route `/api/mcp` (`mcp-handler` + `withMcpAuth`),
routes `.well-known/oauth-*`, squelette `lib/mcp/{auth,server,register,result}` avec un outil
`ping` d'exemple et la convention `tools/`, `lab.json` avec `email: true`. Ajouter `mcp` aux choix
de la skill `/lab-new`. **contentos et ressources ne sont pas migrés.**

## 12. Tests

- **Logique pure** (vitest) : `image-meta`, `tags`, `base64`, `service-auth`, `url-guard`, routeur
  `/v1` — portés depuis la source.
- **Intégration MCP** : par famille d'outils (modèle des tests `mcp-tools-*` de contentos).
- **Runtime** (Gemini, R2, browserless) : vérifié sur la **preview déployée**, sans mock.

## 13. Risques / points ouverts

- **Prérequis browserless (hors atelier)** : le rendu HTML ne marche en preview qu'une fois le
  conteneur partagé provisionné côté plateforme. C'est le point le plus incertain.
- **Timeouts de génération** : Gemini peut prendre 10–30 s ; vérifier que les timeouts Caddy/Next
  tolèrent les appels synchrones `/v1/generate` et `/v1/render-html`.
- **Charge Chromium sur le serveur** : browserless intègre déjà une file d'attente de rendu. Si la
  charge dégrade le serveur lab, échappatoire prévue : déplacer browserless sur un **hôte dédié** —
  l'indirection `BROWSER_URL` rend ce déplacement transparent pour `media`. À surveiller, pas à
  faire d'emblée.
