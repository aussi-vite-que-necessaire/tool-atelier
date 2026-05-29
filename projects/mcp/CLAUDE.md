# mcp — passerelle MCP centrale

Serveur MCP **unique et public** de la suite contentos (`mcp.contentos.ch`). Façade thin,
**sans base** : valide le Bearer OAuth (auth.contentos.ch), récupère le catalogue des backends
internes et **relaie** les appels en préfixant les noms (`media_generate_image`…).

## Repères

- `src/app/api/mcp/route.ts` — porte MCP : `createMcpHandler` + `withMcpAuth`. Seule ressource
  protégée OAuth de la suite (`resource = APP_URL`).
- `src/lib/mcp/gateway.ts` — handlers bas-niveau `tools/list` (agrégation + namespacing +
  dégradation si un backend est down) et `tools/call` (dé-préfixe + route).
- `src/lib/backends.ts` — registre **statique** des backends (`getBackends()`, lecture paresseuse
  d'env). L'URL de chaque backend est **dérivée** de `APP_URL` (swap du sous-domaine `mcp` →
  `media`/`cast`/`ressources`) : la passerelle parle aux backends du **même environnement**
  (preview de la même branche, ou prod). `src/lib/backend-client.ts` parle leur contrat interne.
- `src/lib/mcp/auth.ts` — `verifyMcpToken` (valide le bearer via auth.contentos.ch ; court-circuit
  preview). `.well-known/*` — découverte OAuth (délègue à auth.contentos.ch).

## Backends

Un backend expose `GET /internal/tools` (schémas JSON) et `POST /internal/tools/:name`
(`{ userId, args }`), gardés par une **clé interne partagée** `MCP_INTERNAL_KEY` (scope global)
— sauf en preview, où la vérif est court-circuitée (federation sans secret). La passerelle
transmet le `userId` résolu ; le backend applique son propre scoping (et, pour `ressources`,
résout l'opérateur). Ajouter un tool dans un backend ne nécessite pas de redéployer la passerelle
(catalogue récupéré au runtime) ; ajouter un backend = éditer `src/lib/backends.ts`.

## Dev / déploiement

`npm test` (vitest, fetch mocké, sans réseau ni base). `next build` n'a besoin d'aucune variable
au build (lecture paresseuse au runtime). En attendant le palier d'intégration
`preview.contentos.ch`, la passerelle pointe vers les backends **prod** (cf.
`docs/decisions/0003-passerelle-mcp-centrale.md`). `git push` sur une branche → preview ; merge de
la PR → prod `https://mcp.contentos.ch`. Jamais de commit sur `main`.
