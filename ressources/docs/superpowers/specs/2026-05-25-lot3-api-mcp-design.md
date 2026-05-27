# Lot 3 — Couche service + serveur MCP

## Contexte

Les lots 1-2 servent et gatent des ressources modulaires. Le lot 3 ajoute la **création et
l'édition pilotées par agent IA** : une couche service centralise toutes les écritures sur
`resources`/`pages`/`modules`/`resource_access`, exposée via un serveur **MCP** streamable.
L'usage cible : « j'ai une idée de ressource → l'IA la crée et me renvoie l'URL », plus
l'édition modulaire incrémentale (réorganiser une page sans tout réécrire).

## Objectif

Depuis un client MCP (Claude Code, agent IA) authentifié par clé API, créer une ressource
complète en un appel et récupérer son URL `${APP_URL}/r/<slug>`, puis éditer finement pages et
modules. La couche service est réutilisée telle quelle par le builder visuel du lot 5.

## Périmètre

Dans le lot :

- Couche service : opérations d'écriture/lecture sur ressources, pages, modules, accès privés.
- Serveur MCP streamable HTTP sur `/api/mcp`, protégé par clé API bearer.
- Jeu d'outils MCP : lecture, création bulk, édition fine, gestion d'accès privé.
- Génération de slug + désambiguïsation.
- Tests purs (slug, validation d'entrée des modules, planification d'arborescence) + smoke test
  MCP end-to-end.

Hors lot :

- API REST HTTP (ajoutée au lot 5 avec le builder, sur la même couche service).
- Génération d'images via media-manager (les modules reçoivent des URLs R2 telles quelles).
- Connecteur OAuth pour Claude.ai web (l'auth est par clé API ; OAuth seulement si besoin futur).
- Statistiques (lot 4).

Aucune nouvelle table : le schéma des lots 1-2 est réutilisé.

## Architecture

- **`lib/resources/service.ts`** : le cœur. Fonctions asynchrones sur la base (Drizzle) pour
  créer/éditer/supprimer ressources, pages, modules, et gérer `resource_access`. Aucune
  dépendance à MCP ni à HTTP — réutilisable par le builder.
- **`lib/resources/mcp.ts`** : `registerTools(server)`, façade fine qui mappe chaque outil MCP
  à une fonction du service (à l'image du `store()` partagé de media-manager).
- **`app/api/[transport]/route.ts`** : handler `mcp-handler` (transport streamable sur
  `/api/mcp`) enveloppé d'un contrôle `Authorization: Bearer <ADMIN_API_KEY>` (GET/POST/DELETE).
- Modules pur-logique isolés et testés : `lib/resources/slug.ts`, `lib/resources/module-input.ts`,
  `lib/resources/plan.ts`.

## Schéma d'adressage

Pensé pour l'agent : **ressources par slug**, **pages par chemin de slugs** (depuis la racine,
chemin vide = page racine), **modules par id**. `get_resource` renvoie l'arborescence complète
avec les ids de modules pour que l'agent connaisse l'état avant d'éditer.

## Outils MCP

Entrées validées par Zod ; résultats en JSON dans un bloc texte (convention media-manager).

**Lecture**
- `list_resources` → liste (slug, title, visibility, published, featured).
- `get_resource` `{ slug }` → métadonnées + arborescence (pages avec chemin, modules avec id,
  type, position, content).

**Création bulk**
- `create_resource` `{ slug?, title, description?, visibility?, featured?, published?,
  rootTitle?, rootModules?: Module[], pages?: Page[] }` → `{ id, slug, url }`. Crée la ressource,
  sa page racine (titre `rootTitle` ou `title`), ses modules, et l'arborescence imbriquée.
  `Page = { slug, title, modules?: Module[], children?: Page[] }`. `Module = { type, content }`
  validé par les schémas Zod du lot 1.

**Édition fine**
- `update_resource` `{ slug, patch: { title?, description?, coverImageUrl?, visibility?,
  featured?, published? } }`.
- `delete_resource` `{ slug }`.
- `add_page` `{ resourceSlug, parentPath?, slug, title, position? }`.
- `update_page` `{ resourceSlug, path, patch: { title?, slug? } }`.
- `delete_page` `{ resourceSlug, path }` (refuse de supprimer la page racine).
- `move_page` `{ resourceSlug, path, newParentPath?, position? }` (refuse un déplacement créant
  un cycle).
- `add_module` `{ resourceSlug, path, module: Module, position? }` → `{ id }`.
- `update_module` `{ id, content?, position? }`.
- `delete_module` `{ id }`.
- `reorder_modules` `{ orderedModuleIds }` (réaffecte `position` = index).

**Accès privé**
- `grant_access` `{ resourceSlug, email }`, `revoke_access` `{ resourceSlug, email }` (email
  normalisé via `normalizeEmail` du lot 2).

## Slug et URL

- `slugify(title)` : minuscules, tirets, sans accents.
- `uniqueSlug(base, existing[])` : suffixe `-2`, `-3`… en cas de collision (fonction pure ;
  le service lui passe les slugs existants).
- URL renvoyée : `${APP_URL}/r/<slug>`, `APP_URL` valant `process.env.APP_URL ?? process.env.BETTER_AUTH_URL`.

## Auth

Le handler MCP rejette toute requête sans `Authorization: Bearer <ADMIN_API_KEY>` (401).
Compatible Claude Code (header custom) et appels directs. La clé est un secret d'environnement
mono-admin.

## Validation et erreurs

- Entrée d'un module validée contre `moduleContentSchemas` (lot 1) ; une entrée invalide fait
  échouer l'outil avec un message clair.
- Référence introuvable (slug/chemin/id) → erreur explicite renvoyée à l'agent.
- `delete_page` sur la racine et `move_page` créant un cycle → refus avec message.

## Tests

Vitest, logique pure :
- `slugify` (accents, espaces, casse) et `uniqueSlug` (collisions successives).
- Validation d'entrée des modules (union discriminée par type ; cas valides et rejets).
- `planPages` : aplatit l'arborescence imbriquée en nœuds ordonnés (parent, position) — vérifie
  ordre, imbrication, positions.

Smoke test end-to-end (`scripts/mcp-smoke.ts`, client MCP officiel + transport streamable, clé
API) : `create_resource` avec arborescence → renvoie une URL ; `get_resource` retrouve la
structure ; la ressource featured apparaît sur `/`.

## Env

Ajout à `.env.example` : `ADMIN_API_KEY` (clé bearer) et `APP_URL` (base publique, défaut
`BETTER_AUTH_URL`).

## Critères d'acceptation

1. `npm test` passe (tests existants + nouveaux purs).
2. Une requête MCP sans clé API valide → 401.
3. Avec la clé : `create_resource` crée la ressource + arborescence et renvoie `{ id, slug, url }`.
4. `get_resource` renvoie la structure créée (pages par chemin, modules par id).
5. Les outils d'édition fine modifient pages/modules ; `reorder_modules` change l'ordre de rendu.
6. `grant_access` rend une ressource privée accessible à l'email visé (cohérent avec le lot 2).
7. `npm run build` et `npm run typecheck` passent.
