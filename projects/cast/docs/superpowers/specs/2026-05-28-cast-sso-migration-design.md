# Migration cast vers le SSO `auth.contentos.ch` — design

Cast retire son BetterAuth local et délègue les sessions web à `auth.contentos.ch`
(cookie cross-subdomain). Le serveur MCP de cast délègue son OAuth/OIDC au plugin `mcp()`
centralisé que cette PR ajoute au projet `auth`.

Voir aussi `projects/auth/docs/superpowers/specs/2026-05-28-sso-suite-contentos-design.md`
pour le modèle SSO de la suite.

## Périmètre

1. **Ajouter `mcp()` à `auth`** (préalable embarqué dans cette PR) : plugin BetterAuth
   `mcp()` + tables OAuth/OIDC dans le schéma d'`auth`, route `/api/mcp` n'est PAS exposée
   côté auth — c'est juste l'OAuth provider.
2. **Cast web** : remplacer `auth.api.getSession({ headers })` par un fetch HTTP vers
   `auth.contentos.ch/api/auth/get-session` avec cookie forwardé. Garder les helpers
   `requireUserId` / `getUserId` (interface stable).
3. **Cast MCP** : `verifyMcpToken` (anciennement `auth.api.getMcpSession`) appelle
   `auth.contentos.ch/api/auth/mcp/get-session` (ou équivalent) avec le bearer reçu.
4. **Migration data** (1 user en prod : Manu) : login dans auth → récupère `NEW_ID` →
   UPDATE toutes les FK cast → DROP tables locales user/session/account/verification + OIDC.
5. **Preview** : auto-login local conservé (PREVIEW_USER seedé), pas de SSO réel.
6. **Refactor opportuniste** : nettoyer le dead code auth (page `/signin` devient simple
   redirect vers auth, drop `otp-form.tsx` local, simplifier `env.ts` en retirant
   `BETTER_AUTH_SECRET`).

Hors scope : centraliser la table `brand`, migrer le MCP de media (mission ultérieure),
ouverture OIDC à des apps tierces.

## Architecture cible

### Auth — ajout `mcp()`

Dans `projects/auth/src/lib/auth.ts`, ajouter le plugin :

```ts
import { emailOTP, mcp } from "better-auth/plugins";
// ...
plugins: [
  emailOTP({ /* inchangé */ }),
  mcp({
    loginPage: "/sign-in",
    oidcConfig: {
      loginPage: "/sign-in",
      allowDynamicClientRegistration: true,
      requirePKCE: true,
    },
  }),
],
```

Schéma : générer une nouvelle migration Drizzle (`npm run db:generate`) qui ajoute
`oauth_application`, `oauth_access_token`, `oauth_consent`, `oauth_application_user` (ou
ce que BetterAuth pose). Idempotente (la base preview persiste).

### Cast — session web déléguée

`projects/cast/src/lib/auth/session.ts` ne dépend plus de BetterAuth :

```ts
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isPreview, PREVIEW_USER_ID } from "./preview";

async function fetchSession(h: Headers) {
  if (isPreview) return { user: { id: PREVIEW_USER_ID } };
  const cookie = h.get("cookie");
  if (!cookie) return null;
  const r = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.user ? data : null;
}

export async function requireUserId(): Promise<string> {
  const s = await fetchSession(await headers());
  if (!s) redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`);
  return s.user.id;
}

export async function getUserId(): Promise<string | undefined> {
  const s = await fetchSession(await headers());
  return s?.user.id;
}
```

`env.AUTH_URL` : nouveau env requis en prod (`https://auth.contentos.ch`). En preview,
`isPreview` court-circuite, donc `AUTH_URL` peut être omis sans casser.
`PREVIEW_USER_ID` : id stable seedé en base preview.

### Cast — MCP délégué

`projects/cast/src/lib/mcp/auth.ts` :

```ts
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { env } from "@/lib/env";
import { isPreview, PREVIEW_USER_ID } from "@/lib/auth/preview";

export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  if (isPreview) {
    return {
      token: "preview",
      clientId: "preview",
      scopes: [],
      extra: { userId: PREVIEW_USER_ID },
    };
  }
  const r = await fetch(`${env.AUTH_URL}/api/auth/mcp/get-session`, {
    headers: { authorization: req.headers.get("authorization") ?? "" },
    cache: "no-store",
  });
  if (!r.ok) return undefined;
  const session = await r.json();
  if (!session?.userId) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? "content-os-mcp",
    scopes: typeof session.scopes === "string" ? session.scopes.split(" ").filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}
```

L'endpoint exact côté BetterAuth pour valider un token MCP : à confirmer dans le code du
plugin `mcp()` (probablement `/api/auth/mcp/get-session` ou variante). Si différent,
adapter.

### Page de connexion cast

`projects/cast/src/app/(auth)/signin/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isPreview } from "@/lib/auth/preview";
import { PreviewSignInForm } from "./preview-form";

export default function SignInPage() {
  if (isPreview) return <PreviewSignInForm />;
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`);
}
```

En preview, garde un mini-form qui pose le cookie PREVIEW (pas de SSO). En prod, redirige.

### env.ts

Dans `projects/cast/src/lib/env.ts` :

- Ajouter `AUTH_URL: z.string().url()` requis (avec fallback `''` ou validation conditionnelle
  selon isPreview).
- Retirer `BETTER_AUTH_SECRET` (cast n'en a plus besoin).

### Données — migration en prod

Script `projects/cast/scripts/sso-migrate-user.mjs` exécutable manuellement après le déploiement :

1. Lire `OLD_ID` : `SELECT id FROM "user" LIMIT 1` (Manu = seul user).
2. Récupérer `NEW_ID` (param CLI obligatoire) : id de Manu dans auth.contentos.ch — obtenu par login + `SELECT id FROM "user" WHERE email = ?` côté auth.
3. UPDATE en transaction sur toutes les tables FK : posts, ideas, voice, settings, publications, social_accounts, writing_templates, oauth_application, oauth_access_token, oauth_consent (ou les drop, voir étape 4).
4. DROP tables : user, session, account, verification, oauth_application, oauth_access_token, oauth_consent (le MCP de cast n'a plus de DB OAuth, c'est auth qui l'héberge).
5. Drop le schéma `src/lib/db/schemas/auth.ts` + `oidc.ts`.
6. Générer nouvelle migration Drizzle qui acte tout ça (idempotente — `DROP TABLE IF EXISTS`).

Ordre d'exécution en prod :
1. Déployer la PR (qui retire les imports auth de cast — donc les tables locales ne sont plus écrites mais existent encore).
2. Login dans auth.contentos.ch pour obtenir `NEW_ID`.
3. Lancer le script `sso-migrate-user.mjs <NEW_ID>` via `lab-ssh`.
4. Vérifier : `SELECT COUNT(*) FROM posts WHERE user_id = '<NEW_ID>';` etc.

En preview : pas de migration de data nécessaire (base seedée avec `PREVIEW_USER_ID`).

### Worker

`worker-runner.mjs` consomme depuis Redis. Les jobs portent `userId` dans leur payload
(pas de session web). Aucun changement attendu côté worker tant que `userId` est valide.

## Variables côté cast

- **prod** : `AUTH_URL=https://auth.contentos.ch` à poser via `/lab-secret set cast AUTH_URL`.
- **preview** : non requis (isPreview court-circuite).
- **`BETTER_AUTH_SECRET`** : à retirer du scope `cast` après vérification que plus aucun code ne le lit.

## Tests

- **Unitaires** : tests existants de cast (`npm test`) ne touchent pas la session — ne devraient pas casser. Si certains importent `auth/server.ts`, les adapter pour mocker `fetchSession`.
- **Smoke preview** : navigation `/signin` → auto-login PREVIEW → home accessible.
- **Smoke prod** (manuel après déploiement) :
  1. Visite `cast.contentos.ch` non connecté → redirect vers `auth.contentos.ch/sign-in?redirect=...`.
  2. Login OTP → retour sur `cast.contentos.ch`, header montre user connecté.
  3. `/api/mcp/...` avec bearer obtenu via OAuth/OIDC sur auth → user.id correct dans `extra.userId`.
  4. Création d'un post → `posts.user_id` = `NEW_ID`.

## Risques & mitigations

- **Endpoint MCP get-session côté BetterAuth** : nom à vérifier. Si pas exposé tel quel,
  utiliser `auth.api.getMcpSession` côté projet `auth` et exposer un wrapper `/api/mcp-session`.
  Fallback documenté.
- **Sessions actives invalidées** : Manu devra se relog (acceptable, 1 user).
- **OAuth clients existants** : invalidés (la table oauth_application de cast est droppée).
  Manu re-crée ses connecteurs MCP en passant par le flow OAuth/OIDC de auth.contentos.ch.
  (En réalité, le connecteur Claude se ré-enregistre dynamiquement via
  `allowDynamicClientRegistration`.)
- **Cookie cross-domain en prod** : déjà validé en PR #51 (cookie sur `.contentos.ch`).
- **AUTH_URL absent en prod** : `env.ts` doit lever fort si non défini (sauf preview).
- **Refactor opportuniste** : limiter à ce qui est sur le chemin (signin page, env.ts,
  schemas auth). Pas de refactor des features cast.

## Découpage en tâches (pour `/lab-planifier`)

1. Ajouter `mcp()` à `projects/auth/src/lib/auth.ts` + nouvelle migration Drizzle.
2. Adapter `projects/cast/src/lib/auth/session.ts` (helpers délégués au fetch SSO).
3. Adapter `projects/cast/src/lib/mcp/auth.ts` (verify token via fetch).
4. Adapter `projects/cast/src/app/(auth)/signin/page.tsx` (redirect en prod, form en preview).
5. Adapter `projects/cast/src/lib/env.ts` : ajouter `AUTH_URL`, retirer `BETTER_AUTH_SECRET`.
6. Drop schémas `auth.ts` + `oidc.ts` côté cast, retirer les imports, générer migration `DROP IF EXISTS`.
7. Retirer les fichiers obsolètes : `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `otp-form.tsx`.
8. Écrire `scripts/sso-migrate-user.mjs` (one-shot prod).
9. Smoke build local : `npm install && npm run db:generate && npm run build` doivent passer pour `cast` ET `auth`.
10. CLAUDE.md de cast : refléter le nouveau modèle d'auth (lien vers spec, suppression mention `BETTER_AUTH_SECRET`).
