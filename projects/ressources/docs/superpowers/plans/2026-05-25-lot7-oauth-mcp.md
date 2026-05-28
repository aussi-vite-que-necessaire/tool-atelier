# Lot 7 — OAuth pour le MCP (connecteur Claude.ai) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protéger `/api/mcp` par OAuth 2.1 (DCR) via le plugin `mcp` de better-auth, restreint aux admins, pour le connecter comme connecteur custom dans Claude.ai.

**Architecture:** Le plugin `mcp()` de better-auth (inclut le provider OAuth/OIDC) expose autorisation/token/register/consentement et la découverte. `withMcpAuth(auth, …)` protège l'endpoint MCP (401 + challenge), puis on vérifie que l'utilisateur est admin. Le login réutilise l'OTP existant ; une page de consentement brutaliste finalise le flux. La clé API statique est supprimée.

**Tech Stack:** better-auth (plugin mcp), mcp-handler, Drizzle, Next 16.

**Note d'intégration :** lot d'intégration OAuth — certaines étapes s'ajustent contre le comportement réel de better-auth (schéma exact des tables via CLI, paramètre de redirection du login). Le test final du connecteur se fait dans **Claude.ai** par Manu.

---

## Structure des fichiers

```
lib/auth.ts                                     + plugin mcp
lib/auth-client.ts                              + oidcClient (pour authClient.oauth2.consent)
db/schema/oauth.ts                              tables du plugin (générées via CLI better-auth)
db/schema/index.ts                              + export ./oauth
lib/admin/is-admin.ts                           userIsAdmin(userId) (requête user)
app/.well-known/oauth-authorization-server/route.ts   découverte (helper)
app/.well-known/oauth-protected-resource/route.ts     découverte (helper)
app/api/[transport]/route.ts                    withMcpAuth + contrôle admin (remplace clé statique)
app/oauth/consent/page.tsx                      page de consentement (client)
app/connexion/page.tsx                          honore la redirection du flux OAuth
.env.example                                    retrait d'ADMIN_API_KEY
```

---

## Task 1: Plugin MCP + schéma OAuth

**Files:** Modify `lib/auth.ts`, `lib/auth-client.ts`, `db/schema/index.ts` ; Create `db/schema/oauth.ts`

- [ ] **Step 1: Ajouter le plugin `mcp` dans `lib/auth.ts`** (dans `plugins`, avant `nextCookies()` qui doit rester dernier)

```ts
import { emailOTP, mcp } from "better-auth/plugins"
// …
  plugins: [
    emailOTP({ /* inchangé */ }),
    mcp({
      loginPage: "/connexion",
      oidcConfig: {
        allowDynamicClientRegistration: true,
        consentPage: "/oauth/consent",
      },
    }),
    nextCookies(),
  ],
```

- [ ] **Step 2: Ajouter `oidcClient` dans `lib/auth-client.ts`**

```ts
import { emailOTPClient, oidcClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [emailOTPClient(), oidcClient()],
})
```

- [ ] **Step 3: Générer le schéma des tables du plugin**

Run : `node --env-file=.env.local ./node_modules/@better-auth/cli/dist/index.mjs generate --output db/schema/oauth.ts -y`
(ou `npx @better-auth/cli@latest generate`). Le CLI lit `lib/auth.ts` et produit les tables
OAuth. Tables attendues : `oauthApplication` (clients enregistrés), `oauthAccessToken`,
`oauthConsent`. Vérifier que le fichier `db/schema/oauth.ts` exporte ces tables en Drizzle
pg-core ; ajuster les imports si besoin (`pgTable`, `text`, `timestamp`, `boolean`).

> Si le CLI ne cible pas le bon chemin, créer `db/schema/oauth.ts` à la main à partir de sa
> sortie. Les noms de colonnes doivent rester ceux attendus par better-auth (ne pas renommer).

- [ ] **Step 4: Exporter dans `db/schema/index.ts`**

```ts
export * from "./auth"
export * from "./content"
export * from "./access"
export * from "./stats"
export * from "./oauth"
```

- [ ] **Step 5: Migration + typecheck**

Run :
```bash
npm run db:generate            # nouvelle migration drizzle/00xx_*.sql
npm run db:push                # applique en local
npm run typecheck
```
Expected : tables OAuth créées en local ; aucune erreur de type. (S'il manque le plugin `mcp`
dans la version installée de better-auth, bumper `better-auth` puis `npm install`.)

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts lib/auth-client.ts db/schema/oauth.ts db/schema/index.ts drizzle/
git commit -m "feat: plugin better-auth mcp (OAuth/OIDC + DCR) + schéma OAuth"
```

---

## Task 2: Routes de découverte OAuth

**Files:** Create `app/.well-known/oauth-authorization-server/route.ts`, `app/.well-known/oauth-protected-resource/route.ts`

- [ ] **Step 1: `app/.well-known/oauth-authorization-server/route.ts`**

```ts
import { oAuthDiscoveryMetadata } from "better-auth/plugins"
import { auth } from "@/lib/auth"

export const GET = oAuthDiscoveryMetadata(auth)
```

- [ ] **Step 2: `app/.well-known/oauth-protected-resource/route.ts`**

```ts
import { oAuthProtectedResourceMetadata } from "better-auth/plugins"
import { auth } from "@/lib/auth"

export const GET = oAuthProtectedResourceMetadata(auth)
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add "app/.well-known"
git commit -m "feat: endpoints de découverte OAuth (root)"
```

---

## Task 3: Contrôle admin + protection OAuth de l'endpoint MCP

**Files:** Create `lib/admin/is-admin.ts` ; Modify `app/api/[transport]/route.ts`

- [ ] **Step 1: `lib/admin/is-admin.ts`** (vérifie le flag admin d'un userId)

```ts
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema"

export async function userIsAdmin(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const [u] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, userId)).limit(1)
  return !!u?.isAdmin
}
```

- [ ] **Step 2: Remplacer `app/api/[transport]/route.ts`** (withMcpAuth + admin, sans clé statique)

```ts
import { createMcpHandler } from "mcp-handler"
import { withMcpAuth } from "better-auth/plugins"
import { auth } from "@/lib/auth"
import { registerTools, type ToolServer } from "@/lib/resources/mcp"
import { userIsAdmin } from "@/lib/admin/is-admin"

const mcpHandler = createMcpHandler(
  (server) => registerTools(server as unknown as ToolServer),
  {},
  { basePath: "/api" },
)

const handler = withMcpAuth(auth, async (req: Request, session: { userId?: string }) => {
  if (!(await userIsAdmin(session.userId))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  }
  return mcpHandler(req)
})

export { handler as GET, handler as POST, handler as DELETE }
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/admin/is-admin.ts "app/api/[transport]/route.ts"
git commit -m "feat: MCP protégé par OAuth (withMcpAuth) + restriction admin"
```

---

## Task 4: Page de consentement

**Files:** Create `app/oauth/consent/page.tsx`

- [ ] **Step 1: `app/oauth/consent/page.tsx`** (client ; lit `consent_code`, appelle `authClient.oauth2.consent`)

```tsx
"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export default function ConsentPage() {
  const params = useSearchParams()
  const router = useRouter()
  const consentCode = params.get("consent_code")
  const clientId = params.get("client_id")
  const scope = params.get("scope")
  const [loading, setLoading] = useState<"accept" | "deny" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function decide(accept: boolean) {
    setLoading(accept ? "accept" : "deny")
    setError(null)
    const { error } = await authClient.oauth2.consent({ accept, consent_code: consentCode ?? undefined })
    if (error) {
      setError("Échec. Réessaie.")
      setLoading(null)
      return
    }
    router.refresh()
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-20">
      <h1 className="text-3xl font-black tracking-tight">Autoriser l&apos;accès</h1>
      <p className="mt-3 text-muted-foreground">
        Une application{clientId ? ` (${clientId})` : ""} demande à accéder à tes ressources
        {scope ? ` (${scope})` : ""}.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => decide(true)}
          disabled={loading !== null}
          className="border-4 border-foreground bg-foreground px-4 py-2 font-bold text-background disabled:opacity-50"
        >
          {loading === "accept" ? "…" : "Autoriser"}
        </button>
        <button
          onClick={() => decide(false)}
          disabled={loading !== null}
          className="border-2 border-foreground px-4 py-2 font-bold disabled:opacity-50"
        >
          Refuser
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-muted-foreground">{error}</p>}
    </main>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add app/oauth/consent/page.tsx
git commit -m "feat: page de consentement OAuth"
```

---

## Task 5: Redirection du login dans le flux OAuth

**Files:** Modify `app/connexion/page.tsx`

- [ ] **Step 1: Honorer un paramètre de retour** dans `app/connexion/page.tsx` (le flux OAuth redirige vers `loginPage` avec l'URL de reprise)

```tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { OtpForm } from "@/components/auth/otp-form"

export const dynamic = "force-dynamic"

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect: redirectTo } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect(redirectTo || "/bibliotheque")

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-20">
      <h1 className="text-4xl font-black tracking-tight">Connexion</h1>
      <p className="mt-3 text-muted-foreground">Reçois un code par email pour accéder à ta bibliothèque.</p>
      <div className="mt-8">
        <OtpForm redirectTo={redirectTo || "/bibliotheque"} />
      </div>
    </main>
  )
}
```

> Si better-auth utilise un autre nom de paramètre (ex. `redirectTo`, `return_to`), l'aligner
> après observation du flux réel ; lire les deux par sécurité.

- [ ] **Step 2: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add app/connexion/page.tsx
git commit -m "feat: /connexion honore la redirection du flux OAuth"
```

---

## Task 6: Retrait de la clé API statique

**Files:** Modify `.env.example`

- [ ] **Step 1: Retirer le bloc `ADMIN_API_KEY` de `.env.example`** (garder `APP_URL`)

```
# MCP / API
APP_URL=http://localhost:3001
```

- [ ] **Step 2: Lint + commit**

Run : `npm run lint`
Expected : aucune erreur. (La route MCP n'utilise plus `ADMIN_API_KEY`.)

```bash
git add .env.example
git commit -m "chore: retrait de la clé API statique du MCP (OAuth uniquement)"
```

---

## Task 7: Vérification locale + gates

- [ ] **Step 1: Base + serveur**

```bash
docker compose up -d
npm run db:push
RESEND_API_KEY= RESEND_FROM_EMAIL= npx next dev -p 3001 > /tmp/lab-ress-dev.log 2>&1 &
# attendre "Ready"
```

- [ ] **Step 2: Découverte OAuth**

```bash
B=http://localhost:3001
echo "auth-server : $(curl -s -o /dev/null -w '%{http_code}' $B/.well-known/oauth-authorization-server)"
curl -s $B/.well-known/oauth-authorization-server | jq -r '{issuer, authorization_endpoint, token_endpoint, registration_endpoint}'
echo "protected-resource : $(curl -s -o /dev/null -w '%{http_code}' $B/.well-known/oauth-protected-resource)"
```
Expected : 200 ; JSON avec `registration_endpoint` présent (DCR), endpoints authorize/token.

- [ ] **Step 3: 401 + challenge sur le MCP**

```bash
curl -s -D - -o /dev/null -X POST $B/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE 'HTTP/|www-authenticate'
```
Expected : `401` + en-tête `WWW-Authenticate` pointant vers la métadonnée de ressource.

- [ ] **Step 4: Gates**

```bash
pkill -f "next dev"
npm test && npm run typecheck && npm run lint && npm run build
```
Expected : tout vert (les 57 tests existants restent verts).

- [ ] **Step 5: Commit final éventuel**

```bash
git add -A && git commit -m "test: vérification locale lot 7 (découverte OAuth + challenge 401)"
```

---

## Task 8: Migration prod + redéploiement

- [ ] **Step 1: Pousser le code**

```bash
git push origin main
```

- [ ] **Step 2: Appliquer la migration sur la base de prod** (nouvelles tables OAuth) via l'outillage d'infra, puis GRANT (piège connu)

```bash
cd ~/Code/infra && set -a && . ./.env && set +a
./bin/db-exec ressources < ~/Code/lab-ressources/drizzle/00XX_<nouvelle>.sql   # la migration du lot 7
./bin/db-exec ressources <<'SQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO ressources_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ressources_app;
SQL
```

- [ ] **Step 3: Redéployer + vérifier**

```bash
./bin/coolify-deploy product-ressources
# attendre la fin (poll deployments), puis :
curl -s -o /dev/null -w "auth-server prod : %{http_code}\n" https://ressources.avqn.ch/.well-known/oauth-authorization-server
curl -s -D - -o /dev/null -X POST https://ressources.avqn.ch/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | grep -iE 'HTTP/|www-authenticate'
```
Expected : découverte 200 ; MCP 401 + challenge.

- [ ] **Step 4: Test final dans Claude.ai (Manu)**

Dans Claude.ai → Connecteurs → Ajouter un connecteur personnalisé → URL
`https://ressources.avqn.ch/api/mcp` (champs OAuth vides) → Ajouter → login OTP → consentement →
les outils MCP apparaissent. Tester `list_resources` / `create_resource`.

---

## Self-review (couverture spec → plan)

- Plugin `mcp` (OAuth/OIDC + DCR), réutilise OTP → Task 1. ✓
- Découverte OAuth au root → Task 2. ✓
- `/api/mcp` OAuth-only + admin (403 sinon, 401 challenge sinon) → Task 3. ✓
- Page de consentement → Task 4. ✓
- `/connexion` honore la redirection → Task 5. ✓
- Suppression de la clé statique → Tasks 3 (route) + 6 (env). ✓
- Migration schéma + GRANT + redéploiement → Tasks 1, 8. ✓
- Vérifs (découverte, 401 challenge) + test Claude.ai → Tasks 7, 8. ✓

Cohérence : `userIsAdmin` (is-admin.ts) appelé dans la route (Task 3) ; `mcp()` dans auth.ts (Task 1) fournit `withMcpAuth`/`oAuthDiscoveryMetadata` utilisés Tasks 2-3 ; `oidcClient` (auth-client, Task 1) fournit `authClient.oauth2.consent` utilisé Task 4 ; tables OAuth (Task 1) requises par le runtime du plugin.

**Risques connus à lever en implémentation :** version de `better-auth` exposant `mcp` ; chemin de sortie du CLI de génération de schéma ; nom exact du paramètre de redirection du login ; option exacte d'activation du DCR (`oidcConfig.allowDynamicClientRegistration`). Le test décisif est l'ajout du connecteur dans Claude.ai.
```
