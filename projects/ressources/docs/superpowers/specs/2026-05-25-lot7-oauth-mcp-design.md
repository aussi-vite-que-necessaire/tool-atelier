# Lot 7 — OAuth pour le serveur MCP (connecteur Claude.ai)

## Contexte

Le serveur MCP (`/api/mcp`, lot 3) est protégé par une clé API statique, ce qui convient à
Claude Code mais **pas à Claude.ai web** : ses connecteurs distants n'acceptent que des
serveurs *authless* ou **OAuth** (avec Dynamic Client Registration). Le lot 7 ajoute OAuth au
MCP via better-auth (déjà en place pour l'OTP) pour que Manu connecte le MCP comme connecteur
custom dans Claude.ai.

## Objectif

Dans Claude.ai → « Ajouter un connecteur personnalisé » → URL `https://ressources.avqn.ch/api/mcp`,
champs OAuth vides. Claude s'enregistre dynamiquement (DCR), redirige vers le login OTP
existant, affiche un écran de consentement, et établit la connexion. Seuls les **admins**
peuvent utiliser les outils.

## Périmètre

- Plugins better-auth `mcp` + `oidcProvider` (DCR activé), réutilisant l'OTP existant.
- Endpoints de découverte OAuth au root + CORS.
- `/api/mcp` protégé **uniquement par OAuth**, restreint aux admins.
- Page de consentement.
- `/connexion` honore la redirection du flux OAuth.
- Migration de schéma (tables OAuth) + redéploiement.

Hors lot : multi-tenant, scopes fins, refresh-token rotation avancée.

**Suppression** : la clé API statique (`ADMIN_API_KEY`) et son contrôle dans la route MCP sont
retirés — ce projet ne cible que Claude.ai (pas Claude Code).

## Architecture

- `lib/auth.ts` : ajout du **seul** plugin `mcp({ loginPage: "/connexion", oidcConfig: { allowDynamicClientRegistration: true, consentPage: "/oauth/consent" } })`. Le plugin `mcp` **inclut** le provider OAuth/OIDC ; il expose `/api/auth/mcp/...` (authorize, token, register, consent) et les métadonnées de découverte.
- **Découverte au root** : `app/.well-known/oauth-authorization-server/route.ts` →
  `export const GET = oAuthDiscoveryMetadata(auth)` ; `app/.well-known/oauth-protected-resource/route.ts`
  → `export const GET = oAuthProtectedResourceMetadata(auth)`. Ces helpers better-auth gèrent
  le CORS (routes dédiées = contournement CORS recommandé par la doc).
- `app/api/[transport]/route.ts` : enveloppe le handler MCP avec **`withMcpAuth(auth, …)`** —
  qui émet le bon `401` + `WWW-Authenticate` (challenge pointant vers la métadonnée de
  ressource) quand il n'y a pas de session. À l'intérieur, on vérifie que `session.userId`
  correspond à un utilisateur **admin** (`isAdmin`) ; sinon `403`.
- **Page de consentement** `app/oauth/consent/page.tsx` (style brutaliste) : reçoit
  `consent_code`, `client_id`, `scope` ; affiche « Autoriser Claude à accéder à tes
  ressources ? » avec Accepter / Refuser, qui appellent l'API de consentement better-auth.
- `/connexion` : après login, rediriger vers le paramètre de retour fourni par le flux OAuth
  (sinon `/bibliotheque` comme aujourd'hui).

## Flux (Claude.ai)

1. Ajout du connecteur (URL du MCP) → Claude lit `/.well-known/oauth-protected-resource` puis
   `/.well-known/oauth-authorization-server`.
2. DCR : Claude s'enregistre via `/oauth2/register`.
3. Redirection vers `/connexion` → Manu se connecte par OTP.
4. Écran de consentement → Manu accepte.
5. Claude obtient un token, appelle `/api/mcp` avec ; `withMcpAuth` valide ; l'admin passe, les
   outils répondent.

## Schéma & déploiement

Les plugins oidc/mcp ajoutent des tables (clients OAuth, tokens d'accès, consentements,
clients enregistrés). Procédure : `npm run db:generate` → appliquer le SQL sur la base de prod
via `db-exec ressources` → **`GRANT`** des droits à `ressources_app` (piège connu : tables
créées par le superuser). Puis redéploiement Coolify (`coolify-deploy product-ressources`).
Variables d'env : la clé `ADMIN_API_KEY` n'est plus requise.

## Tests

La majeure partie est de l'intégration (flux OAuth). Tests purs : la **décision d'accès admin**
extraite en fonction pure `isAdminUser(user)` (si non trivialement couverte). Vérifications :

- `/.well-known/oauth-authorization-server` et `/.well-known/oauth-protected-resource`
  répondent en JSON (avec CORS).
- `/api/mcp` sans token → `401` avec `WWW-Authenticate`.
- Après obtention d'un token OAuth (admin) → `tools/list` répond ; un non-admin → `403`.
- **Test final manuel dans Claude.ai** par Manu : ajout du connecteur, login OTP, consentement,
  outils visibles.

## Critères d'acceptation

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` passent.
2. Les endpoints de découverte OAuth répondent (root, CORS).
3. `/api/mcp` exige un token OAuth (401 sinon) et le restreint aux admins (403 sinon).
4. Le connecteur s'ajoute et se connecte dans Claude.ai (login OTP + consentement), et les
   outils MCP sont utilisables par l'admin.
5. Déployé sur `https://ressources.avqn.ch` avec le schéma migré.
