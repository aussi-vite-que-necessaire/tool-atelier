# Spec 11 — Serveur MCP (local, token) — Design

**Objectif** : exposer content-os via un serveur MCP (Streamable HTTP) pour qu'un agent (Claude Code) pilote toutes les fonctionnalités — idées, génération de posts, config éditoriale, images, publication LinkedIn — branché en local via un token Bearer.

## Périmètre

- Serveur MCP monté dans l'app Next.js sur `POST /api/mcp` (transport Streamable HTTP).
- Auth par **personal access token** (Bearer), résolu en `userId`. Toutes les opérations sont scopées à ce user.
- Catalogue de tools couvrant : idées (CRUD), posts (génération/édition/statut/suppression), config éditoriale (**lecture + écriture** : voix, briefing visuel, templates), images/médias (génération, édition IA, rendu template, attache), LinkedIn (statut + **publication directe** + planification + annulation + calendrier).
- Connexion depuis Claude Code via `claude mcp add --transport http`.

Hors périmètre (→ Spec 12) : OAuth 2.1 Provider + connecteur claude.ai « un clic » + déploiement. **Connecter** un compte LinkedIn (flux OAuth navigateur) reste dans l'UI web — le MCP expose seulement le *statut* de connexion. Upload d'image depuis bytes bruts (la génération couvre le besoin).

## Architecture

```
Claude Code ──Bearer token──▶ POST /api/mcp (Streamable HTTP)
                                   │
                          vérif token → userId
                                   │
                         serveur MCP (tools)
                                   │
                   repos + fonctions *-core.ts existantes
```

Le MCP est une **façade** sur l'existant : aucune logique métier dupliquée. Chaque tool appelle les repos / `*-core.ts` déjà testés, scopés au `userId` résolu du token.

### Découpage fichiers

- `src/lib/mcp/token.ts` — génération/hachage/vérification du token (pur, testable).
- `src/lib/db/schemas/api-tokens.ts` — table `api_tokens` + migration.
- `src/lib/db/repositories/api-tokens.ts` — `createApiToken`, `findApiTokenByHash`, `listApiTokens`, `deleteApiToken`, `touchApiToken`.
- `src/lib/mcp/tools/*.ts` — implémentations de tools, **fonctions pures** `(userId, input, deps?) => result`, regroupées par domaine (`ideas.ts`, `posts.ts`, `config.ts`, `media.ts`, `publishing.ts`). Testables en intégration sans transport MCP.
- `src/lib/mcp/server.ts` — construit le serveur MCP, enregistre chaque tool (schéma zod + handler qui délègue à l'implémentation).
- `src/app/api/mcp/route.ts` — route handler : vérifie le Bearer → `userId`, branche le serveur MCP sur la requête.
- `scripts/mcp-token.ts` + script npm `mcp:token` — génère un token pour un user (par email), affiche le token en clair une fois.

### Pile technique

- SDK officiel `@modelcontextprotocol/sdk` (tools déclarés avec schémas zod), monté dans la route Next.js via l'adaptateur Next.js approprié (le choix exact — SDK brut vs adaptateur type `mcp-handler` — est figé au plan après vérification des APIs).
- Transport **Streamable HTTP** (SSE déprécié). Un seul endpoint.

## Authentification (phase locale)

- **Personal access token** : `randomBytes(32)` encodé base64url. Stocké **haché** (SHA-256) dans `api_tokens` (id, userId, name, tokenHash, createdAt, lastUsedAt). Le clair n'est montré qu'à la génération.
- Vérification : la route hache le Bearer entrant, cherche la ligne, en déduit `userId` ; rejet (401) si absent.
- Génération : `npm run mcp:token -- <email>` → crée la ligne, imprime le token + la commande `claude mcp add` prête à coller.
- Connexion : `claude mcp add --transport http content-os http://localhost:3000/mcp --header "Authorization: Bearer <token>"`.

La table et le repo serviront aussi de base au futur OAuth (Spec 12) ; le token reste un mécanisme complémentaire.

## Opérations asynchrones

`generate_post`, `generate_image`, `edit_image`, `render_visual`, `publish_post_now` reposent sur des jobs BullMQ. Les tools correspondants **enfilent le job puis attendent son résultat** (`Job.waitUntilFinished` via `QueueEvents`, timeout ~60 s), puis rechargent l'entité finale (post/media/publication) pour la renvoyer complète à l'agent — un seul appel, artefact prêt.

`schedule_post` retourne immédiatement (rien à attendre). Pour la testabilité, l'implémentation des tools async reçoit un **runner injecté** (`runJob`) ; les tests d'intégration injectent un faux qui renvoie un résultat, et vérifient le chargement/format ; le pipeline réel est déjà couvert par les tests worker (Specs 1-9).

## Catalogue de tools

**Idées** : `list_ideas`, `create_idea {idea, brief?}`, `update_idea {id, idea?, brief?}`, `delete_idea {id}`.

**Posts** : `list_posts`, `get_post {id}`, `generate_post {ideaId, writingTemplateId}` (async→post), `edit_post {id, content}`, `set_post_status {id, status: draft|validated}`, `delete_post {id}`.

**Config éditoriale (lecture + écriture)** : `get_voice` / `set_voice {content}`, `get_visual_briefing` / `set_visual_briefing {content}`, `get_settings`, `list_writing_templates` / `create_writing_template {...}` / `update_writing_template {id, ...}` / `delete_writing_template {id}`, `list_visual_templates`, `list_visual_styles`.

**Images / médias** : `list_gallery_images`, `generate_image {prompt, aspectRatio?, styleId?}` (async→media), `edit_image {sourceMediaId, prompt}` (async→media), `render_visual {templateId, vars, postId?}` (async→media), `attach_media_to_post {postId, mediaId}`, `detach_media {postId}`.

**LinkedIn / publication** : `get_linkedin_connection` (statut + runway, ou « non connecté »), `publish_post_now {postId}` (async→publication publiée + URL), `schedule_post {postId, whenIso}`, `cancel_scheduled {publicationId}`, `list_publications` (planifiées + publiées).

Chaque tool renvoie un résultat structuré (JSON) et une erreur lisible en cas d'échec (ex. « Aucun compte LinkedIn connecté », « Brief requis pour générer »).

## Gestion d'erreur

- Token absent/invalide → 401 avant tout traitement.
- Erreurs métier (entité introuvable, pré-condition manquante) → résultat tool en erreur explicite, pas un crash.
- Timeout d'un job async → erreur claire (« génération trop longue, réessaie »).

## Tests

- **Unit** (`test/unit/mcp-token.test.ts`) : génération produit un token + un hash distinct ; `verify` accepte le bon token, rejette un mauvais.
- **Integration** (`test/integration/mcp-tools.test.ts`) : handlers synchrones bout-en-bout sur la DB de test — `create_idea`/`list_ideas`, `edit_post`/`set_post_status`, `set_voice`/`get_voice`, `schedule_post`+`cancel_scheduled` (enqueue/dequeue mockés), `get_linkedin_connection`. Tools async : runner injecté renvoyant un faux résultat → vérifie le rechargement/format (ex. `generate_post` → renvoie le post chargé).
- **Integration auth** : `findApiTokenByHash` retrouve le bon user ; token inconnu → undefined.
- **Vérification manuelle** (notée, non automatisée) : `npm run mcp:token`, `claude mcp add`, puis lister/appeler les tools depuis Claude Code et via `npx @modelcontextprotocol/inspector`.
