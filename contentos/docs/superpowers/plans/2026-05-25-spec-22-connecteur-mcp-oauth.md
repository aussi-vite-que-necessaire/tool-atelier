# Connecteur MCP distant (OAuth) + déploiement prod — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer le serveur MCP comme connecteur distant installable via OAuth (better-auth), puis le déployer en prod sur Coolify (`contentos.avqn.ch`) et le tester en réel.

**Architecture:** `better-auth` devient le serveur OAuth 2.1 via son plugin `mcp` (sur `oidc-provider`). La route `/api/mcp` garde le wrapper `withMcpAuth` de `mcp-handler` ; seule la fonction `verifyMcpToken` change pour valider un access token OAuth (`auth.api.getMcpSession`). Les tools restent intacts. Deux routes `.well-known` portent la découverte. Le token statique est retiré. Déploiement en Docker Compose (web + worker + redis) piloté par cockpit.

**Tech Stack:** Next.js 16 (App Router), better-auth 1.6.11 (plugins `mcp` + `oidc-provider`), `mcp-handler`, drizzle-orm + drizzle-kit, vitest, Docker, Coolify (via cockpit).

Spec : `docs/superpowers/specs/2026-05-25-spec-22-connecteur-mcp-oauth-design.md`.

**Lecture préalable obligatoire (Next 16 ≠ training data) :**
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md` (ou équivalent middleware dans `01-app`)

**Faits de terrain vérifiés :**
- Les tests `test/integration/mcp-tools-*.test.ts` appellent les **impl** directement (`xImpl.method(userId)`) — ils ne traversent pas l'auth MCP. Retirer le token statique ne les casse pas.
- `auth.api.getMcpSession({ headers })` cherche `oauthAccessToken` par la colonne `accessToken` (**bearer en clair**, pas de hash) et renvoie la ligne (`{ userId, scopes, clientId, accessToken, ... }`) ou `null`.
- `mcp-handler` : `withMcpAuth(handler, verifyToken, { required, resourceMetadataPath })`. `verifyToken: (req, bearer?) => AuthInfo | undefined | Promise<…>`.
- `better-auth/plugins` exporte `mcp`, `oAuthDiscoveryMetadata(auth)`, `oAuthProtectedResourceMetadata(auth)`, `withMcpAuth`.

---

## Structure des fichiers

**Phase A — connecteur OAuth**

| Fichier | Responsabilité |
|---|---|
| `src/lib/auth/server.ts` (modif) | Enregistre le plugin `mcp`. |
| `src/lib/db/schema/*` + `drizzle/*.sql` (créés) | Tables oidc (oauthApplication/oauthAccessToken/oauthConsent) ; drop `api_tokens`. |
| `src/lib/mcp/auth.ts` (modif) | `verifyMcpToken` valide un access token OAuth ; `userIdFrom` inchangé. |
| `src/app/api/mcp/route.ts` (modif) | `withMcpAuth(..., { resourceMetadataPath })`. |
| `src/app/.well-known/oauth-authorization-server/route.ts` (créé) | Métadonnée serveur OAuth. |
| `src/app/.well-known/oauth-protected-resource/route.ts` (créé) | Métadonnée ressource protégée. |
| `src/middleware.ts` (modif) | Laisse passer `.well-known`, `/api/auth`, `/oauth*`. |
| `test/integration/mcp-auth.test.ts` (créé) | `verifyMcpToken` valide/rejette ; découverte. |
| Suppressions | `scripts/mcp-token.ts`, `src/lib/mcp/token.ts`, `src/lib/db/repositories/api-tokens.ts`, `test/unit/mcp-token.test.ts`, script npm `mcp:token`. |

**Phase B — déploiement**

| Fichier | Responsabilité |
|---|---|
| `next.config.ts` (modif) | `output: 'standalone'`. |
| `Dockerfile` (créé) | Build multi-stage, image unique web+worker. |
| `.dockerignore` (créé) | Exclure node_modules, .next, .git, .env. |
| `docker/prod.compose.yml` (créé) | Services `web` + `worker` + `redis` pour Coolify. |

---

## Phase A — Connecteur OAuth

### Task 1 : Plugin `mcp` dans better-auth + schéma DB

**Files:**
- Modify: `src/lib/auth/server.ts`
- Modify: `src/lib/db/schema/` (tables oidc générées) + `drizzle/` (migration générée)

- [ ] **Step 1 : Brancher le plugin `mcp`**

Dans `src/lib/auth/server.ts`, importer et ajouter le plugin (garder `magicLink` et les hooks existants) :

```ts
import { magicLink, mcp } from 'better-auth/plugins';
// …
  plugins: [
    magicLink({ /* inchangé */ }),
    mcp({
      loginPage: '/signin',
      oidcConfig: {
        allowDynamicClientRegistration: true,
        requirePKCE: true,
      },
    }),
  ],
```

- [ ] **Step 2 : Générer le schéma drizzle des tables oidc**

Le plugin ajoute 3 tables (oauthApplication, oauthAccessToken, oauthConsent). Générer leur définition drizzle via la CLI better-auth :

Run: `npx @better-auth/cli@latest generate --y`
Expected : le fichier de schéma drizzle (celui référencé par `drizzle.config.ts`) gagne les 3 tables. Vérifier qu'elles sont bien exportées.

> Si la CLI ne cible pas le bon fichier, définir les tables à la main dans `src/lib/db/schema/` en miroir du schéma du plugin (`node_modules/better-auth/dist/plugins/oidc-provider/`), colonnes en `snake_case` comme le reste du schéma.

- [ ] **Step 3 : Retirer la table `api_tokens` du schéma**

Supprimer la définition `apiTokens` (et son export de type `ApiToken`) du schéma drizzle.

- [ ] **Step 4 : Générer la migration SQL**

Run: `npm run db:generate`
Expected : un nouveau fichier `drizzle/NNNN_*.sql` qui crée les tables oidc et `DROP TABLE api_tokens`.

- [ ] **Step 5 : Appliquer sur la base de dev et la base de test**

Run:
```bash
npm run db:migrate
npm run db:test:prepare
```
Expected : migrations appliquées sans erreur sur `contentos` et `contentos_test`.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/auth/server.ts src/lib/db/schema drizzle
git commit -m "🤖 feat(spec-22): plugin OAuth/MCP better-auth + tables oidc, drop api_tokens"
```

---

### Task 2 : `verifyMcpToken` valide un access token OAuth (TDD)

**Files:**
- Modify: `src/lib/mcp/auth.ts`
- Test: `test/integration/mcp-auth.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `test/integration/mcp-auth.test.ts`. (Adapter le nom de la table/colonnes à ce que Task 1 a généré : `oauthAccessToken`, colonnes `accessToken`, `userId`, `scopes`, `clientId`, `expiresAt`.)

```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createId } from '@/lib/db/id';
import { oauthAccessToken } from '@/lib/db/schema';
import { verifyMcpToken } from '@/lib/mcp/auth';
import { createTestUser } from './helpers/seed';

describe('mcp auth — OAuth', () => {
  test('verifyMcpToken résout le userId depuis un access token OAuth', async () => {
    const userId = await createTestUser('mcpoauth');
    const token = `at_${createId()}`;
    await db.insert(oauthAccessToken).values({
      id: createId(),
      accessToken: token,
      userId,
      clientId: 'test-client',
      scopes: 'openid profile',
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request('https://x/api/mcp', {
      headers: { authorization: `Bearer ${token}` },
    });
    const info = await verifyMcpToken(req);
    expect(info?.extra?.userId).toBe(userId);
  });

  test('verifyMcpToken renvoie undefined sans bearer', async () => {
    const info = await verifyMcpToken(new Request('https://x/api/mcp'));
    expect(info).toBeUndefined();
  });

  test('verifyMcpToken renvoie undefined pour un token inconnu', async () => {
    const req = new Request('https://x/api/mcp', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(await verifyMcpToken(req)).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm run test:integration -- mcp-auth`
Expected : FAIL (l'ancienne signature `verifyMcpToken(req, bearer)` ne lit pas l'access token OAuth).

- [ ] **Step 3 : Réécrire `verifyMcpToken`**

Remplacer le corps de `src/lib/mcp/auth.ts` (garder `userIdFrom` à l'identique) :

```ts
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { auth } from '@/lib/auth/server';

export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? 'content-os-mcp',
    scopes: typeof session.scopes === 'string' ? session.scopes.split(' ').filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}

export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string') throw new Error('userId manquant dans le token');
  return userId;
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm run test:integration -- mcp-auth`
Expected : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/lib/mcp/auth.ts test/integration/mcp-auth.test.ts
git commit -m "🤖 feat(spec-22): verifyMcpToken valide un access token OAuth"
```

---

### Task 3 : Route MCP + découverte + middleware

**Files:**
- Modify: `src/app/api/mcp/route.ts`
- Create: `src/app/.well-known/oauth-authorization-server/route.ts`
- Create: `src/app/.well-known/oauth-protected-resource/route.ts`
- Modify: `src/middleware.ts`

- [ ] **Step 1 : Adapter la route MCP**

`verifyMcpToken` ne prend plus de 2ᵉ argument et le 401 doit pointer vers la métadonnée de ressource :

```ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp/auth';
import { registerAllTools } from '@/lib/mcp/server';

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: 'content-os', version: '1' } },
  { basePath: '/api' },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 2 : Route de métadonnée serveur OAuth**

Créer `src/app/.well-known/oauth-authorization-server/route.ts` :

```ts
import { oAuthDiscoveryMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth/server';

export const GET = oAuthDiscoveryMetadata(auth);
```

- [ ] **Step 3 : Route de métadonnée ressource protégée**

Créer `src/app/.well-known/oauth-protected-resource/route.ts` :

```ts
import { oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { auth } from '@/lib/auth/server';

export const GET = oAuthProtectedResourceMetadata(auth);
```

- [ ] **Step 4 : Middleware — laisser passer l'OAuth**

Dans `src/middleware.ts`, étendre le `matcher` pour exclure les chemins publics OAuth/découverte (en plus de ceux déjà exclus) :

```ts
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!signin|verify|oauth|\\.well-known|api/auth|api/mcp|api/__test__|_next|favicon).*)',
  ],
};
```

- [ ] **Step 5 : Vérifier la découverte à la main (dev)**

Run (dans un terminal avec `npm run dev` lancé) :
```bash
curl -s localhost:3000/.well-known/oauth-protected-resource | jq .
curl -s localhost:3000/.well-known/oauth-authorization-server | jq .
```
Expected : deux JSON de métadonnée OAuth (resource, authorization_servers, endpoints…). Le 401 sur `/api/mcp` sans token porte `WWW-Authenticate` avec `resource_metadata`.

- [ ] **Step 6 : Commit**

```bash
git add src/app/api/mcp/route.ts src/app/.well-known src/middleware.ts
git commit -m "🤖 feat(spec-22): découverte OAuth + 401 WWW-Authenticate sur /api/mcp"
```

---

### Task 4 : Retirer le token statique + docs

**Files:**
- Delete: `scripts/mcp-token.ts`, `src/lib/mcp/token.ts`, `src/lib/db/repositories/api-tokens.ts`, `test/unit/mcp-token.test.ts`
- Modify: `package.json` (retirer le script `mcp:token`), `.env.example`, `AGENTS.md`/doc MCP si elle décrit le token

- [ ] **Step 1 : Vérifier l'absence de références résiduelles**

Run: `grep -rn "mcp-token\|hashToken\|api-tokens\|apiTokens\|createApiToken\|findUserIdByTokenHash\|mcp:token" src scripts test package.json`
Expected : seules les définitions à supprimer (et leurs imports). Noter chaque import à nettoyer.

- [ ] **Step 2 : Supprimer les fichiers + le script npm**

```bash
git rm scripts/mcp-token.ts src/lib/mcp/token.ts src/lib/db/repositories/api-tokens.ts test/unit/mcp-token.test.ts
```
Retirer la ligne `"mcp:token": ...` de `package.json`. Nettoyer tout import résiduel signalé au Step 1.

- [ ] **Step 3 : Mettre à jour `.env.example`**

Remplacer le bloc `# MCP …` de fin de fichier par l'instruction d'install du connecteur OAuth (état cible, pas de contraste) :

```
# MCP — connecteur distant (OAuth). Le serveur est sur ${APP_URL}/api/mcp.
# Ajout dans un agent (ex. Claude Code) :
#   claude mcp add --transport http content-os ${APP_URL}/api/mcp
# Le flux OAuth (login magic-link) s'ouvre à la première connexion.
```

- [ ] **Step 4 : Vérifier le typecheck + lint**

Run:
```bash
npx tsc --noEmit
npm run format
npm run lint
```
Expected : aucune erreur (sinon nettoyer les imports orphelins).

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "🤖 refactor(spec-22): retire le token statique MCP (tout passe par OAuth)"
```

---

### Task 5 : CI verte de bout en bout

- [ ] **Step 1 : Lancer toute la suite**

Run:
```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:worker
npm run test:e2e
```
Expected : tout vert. Si un test d'outil casse, c'est une régression d'import (pas l'auth) → corriger.

- [ ] **Step 2 : Commit éventuel des correctifs, sinon rien.**

---

## Phase B — Déploiement Coolify (via cockpit)

> Outillage : `/Users/ManuAVQN/Code/cockpit` (skill `coolify`, verbes `bin/coolify-*`, `bin/db-*`, `bin/repo-*`, `bin/secret-set`, `bin/coolify-secret-push`). Coolify : `deploy.avqn.ch`, serveur Prod `46.62.162.135`. Wildcard `*.avqn.ch → Prod` → `contentos.avqn.ch` sans record DNS.

### Task 6 : Image de prod (Dockerfile + standalone + compose)

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`, `.dockerignore`, `docker/prod.compose.yml`

- [ ] **Step 1 : Activer le build standalone**

Dans `next.config.ts`, ajouter `output: 'standalone'` (garder `experimental.serverActions`).

- [ ] **Step 2 : Dockerfile multi-stage (image unique web+worker)**

Créer `Dockerfile` :

```dockerfile
FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Image web : Next standalone
FROM base AS web
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# Image worker : code + node_modules complets (tsx + bullmq)
FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "worker"]
```

- [ ] **Step 3 : `.dockerignore`**

```
node_modules
.next
.git
.env
.env.*
test-results
docs
```

- [ ] **Step 4 : Compose de prod**

Créer `docker/prod.compose.yml` (web + worker buildés sur leurs stages respectifs, redis interne ; Postgres = instance centralisée via `DATABASE_URL`) :

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: Dockerfile
      target: web
    environment:
      - APP_URL=https://contentos.avqn.ch
    ports:
      - '3000'
    depends_on: [redis]
  worker:
    build:
      context: ..
      dockerfile: Dockerfile
      target: worker
    depends_on: [redis]
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
volumes:
  redis_data:
```

> Les secrets (DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, …) sont injectés par Coolify comme variables d'environnement partagées par les services — pas en dur ici. `REDIS_URL=redis://redis:6379`.

- [ ] **Step 5 : Build local de sanity**

Run: `docker build -t contentos-web --target web . && docker build -t contentos-worker --target worker .`
Expected : les deux images se construisent.

- [ ] **Step 6 : Commit**

```bash
git add next.config.ts Dockerfile .dockerignore docker/prod.compose.yml
git commit -m "🤖 build(spec-22): image de prod (Next standalone) + compose web/worker/redis"
```

---

### Task 7 : Repo dans l'org GitHub

- [ ] **Step 1 : Transférer le repo vers l'org (convention `product-*`)**

Depuis cockpit :
```bash
cd /Users/ManuAVQN/Code/cockpit
bin/repo-transfer ManuAVQN/content-os-v2 aussi-vite-que-necessaire --rename product-content-os
```
> Adapter à la signature réelle de `repo-transfer` (`bin/repo-transfer --help`). But : `aussi-vite-que-necessaire/product-content-os`, couvert par la GitHub App Coolify (uuid `dsgcg48wcck4ogko0www4wwk`, repos=all).

- [ ] **Step 2 : Re-pointer le remote local**

```bash
cd /Users/ManuAVQN/Code/content-os-v2
git remote set-url origin git@github.com:aussi-vite-que-necessaire/product-content-os.git
git remote -v && git fetch origin
```

- [ ] **Step 3 : Pousser la branche de travail**

```bash
git push origin HEAD
```
Expected : push OK sur l'org. Vérifier via cockpit `bin/registry-sync` que le repo apparaît.

---

### Task 8 : Base, Redis, secrets

- [ ] **Step 1 : Créer la base `contentos` sur le Postgres centralisé de Prod**

```bash
cd /Users/ManuAVQN/Code/cockpit
bin/db-list
bin/db-exec "<postgres-centralisé>" "CREATE DATABASE contentos;"
```
> Récupérer le nom/uuid de l'instance via `bin/db-list`. Construire l'URL interne (`postgres://…@<host>:5433/contentos`) à partir des creds du coffre.

- [ ] **Step 2 : Pousser les secrets dans Bitwarden**

Pour chaque secret prod (`secret-set` lit stdin) :
```bash
printf '%s' "$(openssl rand -base64 32)" | bin/secret-set CONTENTOS_BETTER_AUTH_SECRET
printf '%s' "<url postgres interne>"      | bin/secret-set CONTENTOS_DATABASE_URL
printf '%s' "redis://redis:6379"          | bin/secret-set CONTENTOS_REDIS_URL
# RESEND_API_KEY, RESEND_FROM, LINKEDIN_CLIENT_ID/SECRET, LINKEDIN_API_VERSION,
# TOKEN_ENCRYPTION_KEY, MEDIA_ENGINE_URL, MEDIA_ENGINE_SERVICE_KEY : reprendre
# les valeurs prod (coffre existant ou .env local de Manu).
```

- [ ] **Step 3 : Noter la matrice de variables à pousser sur l'app Coolify**

`APP_URL=https://contentos.avqn.ch`, `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION`, `TOKEN_ENCRYPTION_KEY`, `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY`. Tous les `CONTENT_OS_*_STUB` et `E2E_TESTING` absents. **Aucune clé IA.**

---

### Task 9 : Créer l'app Coolify + déployer

- [ ] **Step 1 : Créer la ressource Coolify (Docker Compose, GitHub App)**

Suivre la recette du skill `coolify` (`POST /api/v1/applications/private-github-app`), build pack **Docker Compose** pointant `docker/prod.compose.yml`, repo `aussi-vite-que-necessaire/product-content-os`, branche `main`, domaine `https://contentos.avqn.ch`, projet `04-Applications`, serveur Prod. Formaliser en `bin/coolify-app-create` dans cockpit (flaggé « à formaliser » par le skill).

- [ ] **Step 2 : Pousser les variables d'environnement**

```bash
cd /Users/ManuAVQN/Code/cockpit
bin/coolify-secret-push content-os CONTENTOS_DATABASE_URL
# … répéter pour chaque secret de la matrice (Task 8 Step 3).
```
Plus les non-secrets (`APP_URL`) via l'API env de l'app.

- [ ] **Step 3 : Lancer les migrations sur la base prod**

Configurer la commande de release / ou exécuter une fois :
```bash
DATABASE_URL=<url prod> npm run db:migrate
```
(via `bin/ssh-exec` sur Prod dans le conteneur, ou un job ponctuel). Objectif : schéma à jour avant le 1ᵉʳ démarrage.

- [ ] **Step 4 : Déployer**

```bash
cd /Users/ManuAVQN/Code/cockpit
bin/coolify-deploy content-os --force
bin/coolify-status content-os
```
Expected : `running:healthy` à terme (asynchrone). Sinon `bin/coolify-logs content-os` pour diagnostiquer.

- [ ] **Step 5 : Mettre à jour le redirect LinkedIn**

Ajouter `https://contentos.avqn.ch/api/linkedin/callback` aux Authorized redirect URLs de l'app LinkedIn.

- [ ] **Step 6 : Vérifier la prod**

```bash
curl -s https://contentos.avqn.ch/.well-known/oauth-protected-resource | jq .
curl -s -o /dev/null -w '%{http_code}\n' https://contentos.avqn.ch/api/mcp   # attendu 401
curl -sI https://contentos.avqn.ch/signin | head -1                          # attendu 200
```

---

### Task 10 : Acceptation réelle + roadmap

- [ ] **Step 1 : Installer le connecteur dans Claude**

`claude mcp add --transport http content-os https://contentos.avqn.ch/api/mcp` (desktop) puis le connecteur distant côté mobile. Compléter le flux OAuth (login magic-link).

- [ ] **Step 2 : Appeler `ping` puis un vrai tool**

Vérifier que `ping` renvoie un `userId`, puis lister les idées → la donnée vient de la base prod.

- [ ] **Step 3 : Mettre à jour `docs/ROADMAP.md`**

Déplacer « Connecteur MCP distant + OAuth » de 🔜 vers ✅. Commit.

```bash
git add docs/ROADMAP.md
git commit -m "🤖 docs(spec-22): connecteur MCP distant + OAuth livré (roadmap)"
git push origin HEAD
```

- [ ] **Step 4 : Prévenir Manu que c'est live.**

---

## Self-review (couverture spec)

- OAuth via plugin `mcp` → Task 1. Découverte → Task 3. Garde d'auth OAuth → Task 2. Tools intacts → vérifié Task 5. Retrait token statique → Task 4. Multi-tenant (magic-link inchangé) → aucun changement requis, couvert. DB (tables oidc + drop api_tokens) → Task 1. Tests → Tasks 2 & 5. Dockerfile/standalone/compose+redis → Task 6. Repo org → Task 7. Postgres+secrets → Task 8. App Coolify + deploy + migrations + LinkedIn redirect → Task 9. Acceptation desktop+mobile + roadmap → Task 10.
- Dette assumée (media-engine partagé) : hors périmètre, conforme à la spec.
