# Spec 22 — Connecteur MCP distant (OAuth) + déploiement prod

Productiser la surface de tools : exposer le serveur MCP comme **connecteur distant
installable** dans n'importe quel agent (Claude desktop/mobile, GPT, Gemini) via OAuth,
puis le **déployer en prod sur Coolify** (`contentos.avqn.ch`) pour le tester en réel.

C'est le point 1 de la roadmap (`docs/ROADMAP.md`) et le socle des chantiers suivants
(déclinaisons GPT/Gemini, multi-plateformes sociales). Vision : `docs/superpowers/specs/2026-05-25-direction-os-pour-agents-design.md`.

## Objectif

Un utilisateur ajoute ContentOS comme connecteur dans son agent en pointant
`https://contentos.avqn.ch/api/mcp`. L'agent découvre tout seul le serveur OAuth, lance le
flux (login magic-link existant), obtient un access token, et appelle les tools. L'auth est
multi-tenant : toute nouvelle adresse crée un compte (seed des defaults) à la première
connexion.

## Architecture

`better-auth` devient le **serveur OAuth 2.1** via son plugin `mcp` (bâti sur
`oidc-provider`, déjà présents dans `better-auth@1.6.11`). La route `/api/mcp` valide des
**access tokens OAuth** au lieu d'un token statique. Des endpoints de découverte permettent à
l'agent de s'auto-configurer. Le login réutilise le **magic-link** en place.

Découpage en unités à frontières nettes :

- **Serveur OAuth (better-auth)** — émet et valide les tokens, gère DCR (enregistrement
  dynamique de client), le login et le consentement. Entrée : config du plugin. Dépend de :
  la base (tables oidc) et du login magic-link existant.
- **Découverte** — deux routes `.well-known` qui décrivent le serveur OAuth et la ressource
  protégée. Entrée : l'instance `auth`. Sortie : métadonnée JSON standard.
- **Garde d'auth MCP** — `verifyMcpToken` traduit un access token OAuth en `userId`. Entrée :
  la requête + le bearer. Sortie : `AuthInfo { extra: { userId } }`. C'est la **seule**
  pièce de la chaîne MCP qui change ; les tools restent intacts.
- **Tools MCP** — inchangés. Ils lisent le `userId` via `userIdFrom(extra)` /
  `handle(extra, fn)`, alimentés par la garde d'auth.

### Flux d'auth

1. L'agent appelle `/api/mcp` sans token → `401` portant `WWW-Authenticate` qui pointe vers
   `/.well-known/oauth-protected-resource`.
2. L'agent lit la métadonnée de ressource, puis
   `/.well-known/oauth-authorization-server` → endpoints OAuth.
3. DCR : l'agent enregistre un client (ligne `oauthApplication`).
4. Redirection vers `/signin` (option `loginPage`) → l'utilisateur fait le magic-link →
   session. Toute nouvelle adresse crée le compte + seed des defaults.
5. Consentement, puis émission de l'access token (ligne `oauthAccessToken`).
6. L'agent rappelle `/api/mcp` avec le bearer → `verifyMcpToken` résout le `userId` → tools.

## Composants (phase A — connecteur)

| Fichier | Changement |
|---|---|
| `src/lib/auth/server.ts` | Ajout du plugin `mcp({ loginPage: '/signin' })`. |
| `src/lib/mcp/auth.ts` | `verifyMcpToken` valide un access token OAuth via better-auth (`getMcpSession`) et renvoie `AuthInfo { extra: { userId } }`. `userIdFrom` inchangé. |
| `src/app/api/mcp/route.ts` | Conserve `withMcpAuth(base, verifyMcpToken, { required: true })` ; le `401` renvoie le chemin de la métadonnée de ressource. |
| `src/app/.well-known/oauth-authorization-server/route.ts` | `oAuthDiscoveryMetadata(auth)`. |
| `src/app/.well-known/oauth-protected-resource/route.ts` | `oAuthProtectedResourceMetadata(auth)`. |
| `src/app/oauth/consent/page.tsx` | Écran de consentement minimal (ou consentement first-party automatique si le plugin l'autorise — tranché à l'implémentation). |
| `src/middleware.ts` | Laisse passer sans session : `.well-known/*`, les endpoints OAuth, `/oauth/consent`. |
| Migration drizzle | Ajout des tables oidc de better-auth ; drop de `api_tokens`. |

### Retrait du token statique

L'auth MCP passe entièrement par OAuth. On supprime :

- `scripts/mcp-token.ts` et le script npm `mcp:token` ;
- `src/lib/mcp/token.ts` (`hashToken`) ;
- le repo `src/lib/db/repositories/api-tokens.ts` et la table `api_tokens` ;
- `test/unit/mcp-token.test.ts`.

La section MCP de `.env.example` et la doc d'install décrivent l'ajout du **connecteur OAuth**
(URL `…/api/mcp`) à la place de la génération de token.

## Multi-tenant

Le magic-link crée déjà l'utilisateur et seed ses defaults à la première connexion :
l'inscription ouverte fonctionne telle quelle. Chaque access token est scopé à son `userId`,
et les tools isolent déjà par `userId`.

Dette assumée, hors périmètre : le **media-engine reste partagé** (clé de service unique, pas
de scoping par tenant) — déjà au backlog (`docs/ROADMAP.md`).

## Tests (critère de fin de phase A)

- **Intégration** : `verifyMcpToken` accepte un access token OAuth valide, rejette
  absent/invalide (`401` + `WWW-Authenticate`) ; les routes `.well-known` renvoient la
  métadonnée attendue.
- Le harness des `test/integration/mcp-tools-*.test.ts` (qui frappe aujourd'hui un token
  statique) bascule sur la création d'un access token OAuth → **toute la suite d'outils reste
  verte**.
- Pas d'E2E navigateur sur la danse OAuth (coûteux et fragile). L'acceptation réelle = test
  manuel après déploiement (phase B).
- CI verte (unit / integration / worker / e2e) avant de passer à la phase B.

## Déploiement Coolify (phase B)

Délégué à l'assistant via **l'outillage d'infra** (skill `coolify`, verbes
`coolify-*` / `db-*` / `secret-*`). Coolify : `deploy.avqn.ch`, serveur **Prod**
(`46.62.162.135`). Le wildcard `*.avqn.ch → Prod` couvre `contentos.avqn.ch` : aucun record
DNS à créer.

### Build

- **`Dockerfile`** de prod (multi-stage, Next.js `output: 'standalone'` ajouté à
  `next.config.ts`).
- Déploiement en **Docker Compose** dans Coolify, depuis le repo : services `web`
  (`next start`) et `worker` (`npm run worker`) bâtis sur la même image, plus un `redis`
  (l'infra n'a pas encore de Redis ; bullmq en a besoin).
- **Postgres** : base `contentos` sur le Postgres centralisé de Prod (créée via l'outillage
  d'infra `db-*`).

### Prérequis

1. **Repo accessible à Coolify.** Le remote est `github.com/ManuAVQN/content-os-v2` (perso) ;
   la GitHub App Coolify est sur l'org `aussi-vite-que-necessaire`. On transfère le repo dans
   l'org (`repo-transfer`, convention `product-*`) pour que la GitHub App le couvre.
2. **Création de l'app Coolify** : `POST /api/v1/applications/private-github-app` selon la
   recette du skill `coolify` ; on la formalise en verbe `bin/coolify-app-create` dans l'outillage
   d'infra (déjà flaggé « à formaliser » par le skill).

### Secrets (Bitwarden → `secret-set`, puis `coolify-secret-push`)

`BETTER_AUTH_SECRET`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `RESEND_FROM`,
`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION`,
`TOKEN_ENCRYPTION_KEY`, `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY`. `APP_URL` =
`https://contentos.avqn.ch`. Tous les stubs (`CONTENT_OS_*_STUB`, `E2E_TESTING`) à vide/`0`.
Pas de clé IA en prod (rédaction → skill, média → media-engine).

### Mise en service

- Migrations jouées au déploiement (`drizzle-kit migrate`).
- Redirect LinkedIn mis à jour vers `https://contentos.avqn.ch/api/linkedin/callback`.
- État vérifié via `coolify-status` / `coolify-logs`.

## Acceptation

Installer ContentOS comme connecteur distant dans Claude (desktop **et** mobile) sur
`https://contentos.avqn.ch/api/mcp`, compléter l'OAuth, appeler `ping` → renvoie le `userId`,
puis un vrai tool (ex. lister les idées) qui agit sur la base de prod.
