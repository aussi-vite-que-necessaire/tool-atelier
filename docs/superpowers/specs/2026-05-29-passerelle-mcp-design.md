# Passerelle MCP centrale — tranche `media` pilote (design)

**Date.** 2026-05-29
**Cadre.** ADR-0003 (`docs/decisions/0003-passerelle-mcp-centrale.md`)
**Périmètre.** Première tranche verticale : squelette de la passerelle + contrat interne
passerelle↔backend + un seul outil pilote (`media`) câblé de bout en bout. `cast`, `ressources`
et la refonte du starter `mcp` / `/nouveau-projet` font l'objet de specs séparés.

## Objectif

Un seul serveur MCP public — `mcp.contentos.ch` — qui fédère les tools des outils de la suite.
Cette tranche prouve tout le pattern sur `media` : OAuth uniquement à la passerelle, backend
devenu interne (service-key + `userId` transmis), namespacing des tools, sorties URL-only,
dégradation partielle.

## Architecture & flux

Nouveau projet `projects/mcp/` (base Next.js, **pas de DB**, classe `hello`), déployé sur
`mcp.contentos.ch`. Seul serveur MCP public de la suite. `media` devient un backend interne,
joignable uniquement sur le réseau lab.

```
Agent/client ──(MCP + Bearer OAuth)──▶ mcp.contentos.ch /api/mcp
                                          1. verifyMcpToken(bearer) → userId  (via auth.contentos.ch)
                                          2. route le tool namespacé → backend
                                          ▼
                         media (réseau lab, interne) /internal/tools/:name
                              Authorization: service-key
                              body { userId, args }
                                          3. exécute le handler, scoping par userId
                                          ▼
                              { result }  ──▶ relayé tel quel au client
```

- `tools/list` = union des tools de chaque backend, **préfixés** (`media_generate_image`…).
- `tools/call` = la passerelle dé-préfixe, appelle le backend, relaie le résultat.
- OAuth **uniquement** à la passerelle ; `auth.contentos.ch` inchangé. `media` ne valide plus de
  token : il fait confiance à la service-key et au `userId` transmis.

## Composant : contrat interne (côté `media`)

Deux routes HTTP, protégées par une **service-key par backend** — qui réutilise la clé de service
existante du backend (côté `media` : `MEDIA_ENGINE_SERVICE_KEY`, déjà en place pour `/v1`). La
passerelle détient cette clé par backend (`MEDIA_SERVICE_KEY`) :

| Route | Entrée | Sortie |
| --- | --- | --- |
| `GET /internal/tools` | header service-key | `{ tools: [{ name, description, inputSchema }] }` — `inputSchema` en **JSON Schema** (conversion depuis Zod via l'utilitaire du SDK MCP) |
| `POST /internal/tools/:name` | service-key + `{ userId, args }` | `{ result }` (content blocks MCP) ou `{ error }` |

- `media` renvoie ses noms **bruts** (`generate_image`) ; il ignore tout du namespacing. La
  passerelle préfixe/dé-préfixe.
- La service-key authentifie *la passerelle* (pas l'utilisateur). Le `userId` est transmis dans
  le body, déjà résolu et de confiance.
- Requête sans service-key valide → `401`, sans toucher la logique métier.

## Composant : la passerelle

- **Porte OAuth.** `/api/mcp` = `createMcpHandler` + `withMcpAuth(verifyMcpToken)`, même pattern
  que les outils actuels mais unique instance. `resource = https://mcp.contentos.ch`.
  `.well-known/oauth-protected-resource` + redirect `oauth-authorization-server` vers
  `auth.contentos.ch`. Preview = court-circuit `PREVIEW_USER_ID`, comme les autres outils.
- **Registry de backends — statique.** Config : `[{ prefix: "media", baseUrl:
  env.MEDIA_INTERNAL_URL }]`. La liste des backends est statique (v1 = `media` seul) ; les tools
  sont récupérés **dynamiquement** via `GET /internal/tools` → ajouter un tool dans `media` ne
  nécessite pas de redéployer la passerelle.
- **Namespacing.** À `tools/list` : préfixe `media_` + nom brut. À `tools/call` : découpe
  `media_xxx` → backend `media`, tool `xxx`. Collision impossible entre backends.
- **Dégradation partielle.** `media` injoignable au `tools/list` → ses tools sont omis (+ log),
  la liste ne plante pas. `tools/call` vers un backend down → résultat MCP `isError`, pas un
  crash transport.
- **Client backend.** Module fin : `listTools(backend)` et `callTool(backend, name, userId,
  args)`, qui posent la service-key et parlent le contrat ci-dessus.

## Changements côté `media`

- **Retrait :** `withMcpAuth`, la route `/api/mcp`, les deux `.well-known`, l'usage *serveur* de
  `mcp-handler`/`@modelcontextprotocol/sdk` (on garde le SDK juste pour l'utilitaire Zod→JSON
  Schema si nécessaire). Le middleware laisse passer `/internal/*` (service-key) à la place de
  `/api/mcp`.
- **Ajout :** les deux routes `/internal/*` + la garde service-key.
- **Refactor des handlers :** le `userId` vient désormais en **paramètre** (depuis le body), plus
  de `userIdFrom(extra)` OAuth. Le scoping par `userId` est **inchangé** — seule change la source
  du `userId`. On extrait la déclaration des tools en une structure réutilisable
  `{ name, description, schema, handler(userId, args) }`, consommée par les deux routes internes.
- **URL-only :** suppression de `imageResult`/base64. `generate_image`, `edit_image`,
  `render_html`, `render_template` renvoient du JSON `{ id, url, … }` via `jsonResult`. Plus aucun
  binaire sur le canal MCP.

## Erreurs

- Erreur métier → `{ error }` relayé en résultat MCP `isError`.
- Service-key invalide/absente → `401`.
- Backend injoignable → dégradation partielle (cf. passerelle).

## Tests (TDD, red→green)

- **`media` interne :** `GET /internal/tools` renvoie les schémas et exige la clé ;
  `POST /internal/tools/:name` exécute, scope par `userId`, rejette une clé absente/fausse ;
  sorties image **URL-only** (assert : pas de base64). Les tests MCP existants de `media` sont
  retargetés vers le contrat interne (via les handlers).
- **Passerelle :** `tools/list` agrège + préfixe (backend `media` mocké) ; `tools/call`
  dé-préfixe + transmet `userId` + relaie le résultat ; porte OAuth (401 sans bearer) ;
  dégradation quand le backend est injoignable.

## Hors périmètre (laissé au plan d'implémentation / specs suivants)

- **Déploiement :** hostname/port du conteneur `media` sur le réseau lab, injection de
  `MEDIA_INTERNAL_URL` et du secret service-key, et le fait que la passerelle pointe vers `media`
  **prod** en attendant le palier d'intégration `preview.contentos.ch`
  (`docs/ideas/2026-05-29-palier-integration-preview.md`).
- **Outils suivants :** bascule de `cast` et `ressources` (dont le check opérateur ADR-0002
  préservé via le `userId` transmis).
- **Plomberie :** refonte du module starter `mcp` et du skill `/nouveau-projet` (un nouvel outil
  expose un endpoint interne + s'enregistre auprès de la passerelle, au lieu d'un MCP public).
- **Améliorations différées :** enregistrement automatique des backends via `lab.json` +
  `deploy.sh` ; scoping fin du token ; filtrage/regroupement du catalogue.
