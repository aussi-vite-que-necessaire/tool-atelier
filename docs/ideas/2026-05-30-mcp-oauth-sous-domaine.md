# Endpoint MCP : OAuth par utilisateur + sous-domaine `mcp.contentos.ch` — idée en backlog

Capturée pendant la refonte « suite unifiée » (app unique). Le strict nécessaire MCP est
en place ; ces deux évolutions sont sorties du périmètre de la nuit.

## Contexte (30/05/2026)

Tous les outils de la suite (cast + media + ressources, 66 outils + `ping`) sont servis par
un **endpoint MCP in-app unique**, `/api/mcp` (`projects/app/src/app/api/mcp/route.ts`),
adossé au registre commun `src/lib/mcp/registry.ts`. L'auth (`src/lib/mcp/endpoint-auth.ts`)
est volontairement simple :

- **session de la suite** (cookie BetterAuth) prioritaire → `userId` résolu côté serveur ;
- sinon **canal de confiance** : bearer `MCP_INTERNAL_KEY` (prod) ou preview ouverte, avec
  `userId` fourni dans le corps.

Pas d'OAuth, pas de sous-domaine dédié. `/internal/tools` (contrat « userId dans le corps »)
subsiste comme variante interne, sur le même registre et la même garde.

## L'idée — deux paliers, quand un client MCP externe se présentera

1. **OAuth par utilisateur sur `/api/mcp`.** Le canal bearer actuel est une clé partagée
   globale : il convient à un appelant de confiance, pas à un client MCP tiers qui doit
   s'authentifier au nom d'un utilisateur précis. Brancher le flow OAuth du SDK MCP
   (`@modelcontextprotocol/sdk`) sur BetterAuth (autorisation + émission de tokens portant le
   `userId`), pour que `authInfo.extra.userId` provienne du token plutôt que d'un champ de corps.

2. **Sous-domaine `mcp.contentos.ch`.** Exposer l'endpoint sur un host dédié (proxy → même app,
   ou route réécrite), plus lisible pour configurer un client MCP, et qui isole la surface MCP
   de l'UI de la suite.

## Déclencheur

Quand un **client MCP externe** (hors agents de l'atelier en session de confiance) doit se
connecter à la suite au nom d'un utilisateur — c'est là qu'OAuth devient nécessaire et que le
sous-domaine dédié prend son sens.
