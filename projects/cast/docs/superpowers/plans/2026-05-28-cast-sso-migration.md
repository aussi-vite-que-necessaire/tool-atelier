# Migration cast vers SSO `auth.contentos.ch` — plan d'implémentation

> **Exécution :** invoque `/lab-implémenter` pour exécuter ce plan tâche par tâche. Les steps utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** retirer le BetterAuth local de cast et déléguer (a) les sessions web au cookie SSO de `auth.contentos.ch`, (b) l'OAuth/OIDC du MCP au plugin `mcp()` centralisé dans `auth`. Migration data : 1 user (Manu).

**Architecture:** `auth.contentos.ch` héberge BetterAuth (+ plugin `mcp()` ajouté par cette PR). cast lit la session via fetch HTTP `GET ${AUTH_URL}/api/auth/get-session` (cookie forwardé), et valide les bearer MCP via `GET ${AUTH_URL}/api/auth/mcp/get-session`. Preview = auto-login local (`PREVIEW_USER_ID` constant), pas de SSO réel.

**Tech Stack:** BetterAuth 1.6.x, Drizzle ORM, Next.js 16 App Router.

Spec de référence : `projects/cast/docs/superpowers/specs/2026-05-28-cast-sso-migration-design.md`.

## Décisions tranchées sans demander

- **Cookies en middleware (proxy.ts)** : check de présence du cookie session (pas de fetch — trop lourd par requête). Validation réelle déléguée aux pages via `requireUserId`.
- **Drop complet de `email/` côté cast** : seul `auth/server.ts` l'utilisait (envoi OTP). Drop = simplification nette. Implique aussi de supprimer `app/api/__test__/emails/route.ts` et `test/unit/email.test.ts` dans le même commit.
- **`.well-known/oauth-protected-resource`** : servir manuellement le JSON pointant vers `AUTH_URL`.
- **`.well-known/oauth-authorization-server`** : redirect 302 vers le même chemin sur `AUTH_URL`.
- **Endpoint MCP côté auth** : `/api/auth/mcp/get-session` (confirmé dans le source BetterAuth 1.6.x : `node_modules/better-auth/dist/plugins/mcp/index.mjs` ligne 682).
- **Cookie BetterAuth** : nom `better-auth.session_token` (ou `__Secure-better-auth.session_token` en HTTPS) — c'est ce que cherche la regex du middleware.
- **Sign-out** : redirige vers `${AUTH_URL}/api/auth/sign-out` (endpoint POST BetterAuth) ; ou simple navigation `${AUTH_URL}` (la page d'accueil d'auth a un bouton). On choisit le redirect navigation simple : header de cast a un lien "Se déconnecter" qui ouvre `${AUTH_URL}` — l'user clique pour se logout proprement depuis auth.
- **AUTH_URL** : variable d'env **requise**. Pas de default qui masquerait une mauvaise config en prod. En preview/local, `isPreview` court-circuite tous les fetchs vers auth → la valeur n'est jamais lue, mais le parse Zod la veut quand même. Solution : `AUTH_URL: z.string().url().default('https://auth.contentos.ch')` ET un garde runtime dans `session.ts`/`mcp/auth.ts` qui throw si on essaie d'appeler en prod alors que `AUTH_URL === default`. Voir Task 5.

## Inventaire (vérifié dans le code)

Fichiers qui importent `@/lib/auth/server` (utilisent `auth.api.getSession` directement, à réécrire avec les helpers) :
- `src/proxy.ts` (réécrit en Task 4.1)
- `src/app/(app)/layout.tsx`
- `src/app/(app)/page.tsx`
- `src/app/(settings)/layout.tsx`
- `src/app/api/preview-login/route.ts` (réécrit en Task 4.4)
- `src/app/api/auth/[...all]/route.ts` (à supprimer)
- `src/app/.well-known/oauth-{authorization-server,protected-resource}/route.ts` (réécrits en Task 6)
- `src/app/(auth)/signin/page.tsx` (réécrit en Task 4.2)
- `src/app/(auth)/signin/otp-form.tsx` (à supprimer en Task 4.3)

Fichier qui importe `@/lib/auth/client` (client-side BetterAuth) :
- `src/components/layout/app-header.tsx` (réécrit en Task 4bis)

Fichiers qui importent `@/lib/email/*` (devenu obsolète) :
- `src/lib/auth/server.ts` (sera supprimé)
- `src/app/api/__test__/emails/route.ts` (à supprimer en Task 7)
- `test/unit/email.test.ts` (à supprimer en Task 7)

Pour les autres fichiers qui n'importent QUE `requireUserId`/`getUserId` depuis `@/lib/auth/session` : aucune modification nécessaire — l'interface reste stable.

---

## Task 1 — Ajouter le plugin `mcp()` au projet `auth`

Le projet `auth` doit héberger l'OAuth/OIDC pour les MCP de la suite. Cette tâche ajoute le plugin + les tables OAuth au schéma Drizzle + génère la migration.

- [ ] **Step 1.1** — Créer `projects/auth/src/db/schemas/oidc.ts` avec le contenu suivant :
  ```ts
  import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
  import { user } from "./auth";

  export const oauthApplication = pgTable("oauth_application", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: boolean("disabled").default(false),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  });

  export const oauthAccessToken = pgTable(
    "oauth_access_token",
    {
      id: text("id").primaryKey(),
      accessToken: text("access_token").notNull().unique(),
      refreshToken: text("refresh_token").notNull().unique(),
      accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
      refreshTokenExpiresAt: timestamp("refresh_token_expires_at").notNull(),
      clientId: text("client_id")
        .notNull()
        .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
      userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
      scopes: text("scopes").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => [
      index("oauth_access_token_client_id_idx").on(t.clientId),
      index("oauth_access_token_user_id_idx").on(t.userId),
    ],
  );

  export const oauthConsent = pgTable(
    "oauth_consent",
    {
      id: text("id").primaryKey(),
      clientId: text("client_id")
        .notNull()
        .references(() => oauthApplication.clientId, { onDelete: "cascade" }),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      scopes: text("scopes").notNull(),
      consentGiven: boolean("consent_given").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => [
      index("oauth_consent_client_id_idx").on(t.clientId),
      index("oauth_consent_user_id_idx").on(t.userId),
    ],
  );
  ```

- [ ] **Step 1.2** — Réécrire `projects/auth/src/db/schema.ts` (le barrel est checked-in, pas regénéré par `db:generate`) :
  ```ts
  import { user, session, account, verification } from "./schemas/auth";
  import { oauthApplication, oauthAccessToken, oauthConsent } from "./schemas/oidc";

  export { user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent };

  export const schema = {
    user, session, account, verification,
    oauthApplication, oauthAccessToken, oauthConsent,
  };
  ```

- [ ] **Step 1.3** — Modifier `projects/auth/src/lib/auth.ts` via deux Edit :

  Edit A — remplacer l'import des plugins :
  - old : `import { emailOTP } from "better-auth/plugins";`
  - new : `import { emailOTP, mcp } from "better-auth/plugins";`

  Edit B — étendre le tableau `plugins` (juste après le `}),` qui clôt `emailOTP({…})`) :
  - old :
    ```
      plugins: [
        emailOTP({
    ```
  - Pas de changement de l'ouverture. À la place, insérer la nouvelle entrée mcp() **avant** le `]` qui ferme le tableau. Repérer le `]` qui suit `}),` de emailOTP. Effectuer l'Edit suivant :
  - old :
    ```
        }),
      ],
    });

    export type Session = typeof auth.$Infer.Session;
    ```
  - new :
    ```
        }),
        mcp({
          loginPage: "/sign-in",
          oidcConfig: {
            loginPage: "/sign-in",
            allowDynamicClientRegistration: true,
            requirePKCE: true,
          },
        }),
      ],
    });

    export type Session = typeof auth.$Infer.Session;
    ```

- [ ] **Step 1.4** — Générer la migration Drizzle :
  ```bash
  cd projects/auth && npm install --no-audit --no-fund && npm run db:generate
  ```
  **Attendu** : nouveau fichier `projects/auth/drizzle/0001_*.sql` ajoutant `oauth_application`, `oauth_access_token`, `oauth_consent`. Vérifier le `_journal.json` mis à jour automatiquement.

- [ ] **Step 1.5** — Smoke build auth :
  ```bash
  cd projects/auth && npm run build 2>&1 | tail -20
  ```
  **Attendu** : `Compiled successfully`. Warning `default secret` est attendu hors prod, OK.

- [ ] **Step 1.6** — Commit :
  ```bash
  git add projects/auth/src/db/schemas/oidc.ts projects/auth/src/db/schema.ts projects/auth/src/lib/auth.ts projects/auth/drizzle/
  git commit -m "🔌 auth: ajoute plugin mcp() + tables OAuth/OIDC"
  ```

---

## Task 2 — Adapter `lib/auth/preview.ts` côté cast (ajout PREVIEW_USER_ID)

- [ ] **Step 2.1** — Edit `projects/cast/src/lib/auth/preview.ts` :
  - old :
    ```
    export const PREVIEW_USER = 'preview@cast.local';
    // Code OTP déterministe accepté en preview (jamais en prod).
    export const PREVIEW_OTP = '000000';
    ```
  - new :
    ```
    export const PREVIEW_USER = 'preview@cast.local';
    // ID stable du preview user, seedé en base preview.
    export const PREVIEW_USER_ID = 'preview-user';
    // Code OTP déterministe accepté en preview (jamais en prod). Conservé
    // tant que des helpers de test ou anciens flux y font référence ;
    // l'OTP réel passe désormais par auth.contentos.ch.
    export const PREVIEW_OTP = '000000';
    ```

- [ ] **Step 2.2** — Commit :
  ```bash
  git add projects/cast/src/lib/auth/preview.ts
  git commit -m "✨ cast/preview: ajoute PREVIEW_USER_ID stable"
  ```

---

## Task 3 — Refactor `lib/auth/session.ts` (helpers délégués au fetch SSO)

- [ ] **Step 3.1** — Réécrire complètement `projects/cast/src/lib/auth/session.ts` :
  ```ts
  import { headers } from 'next/headers';
  import { redirect } from 'next/navigation';
  import { env } from '@/lib/env';
  import { isPreview, PREVIEW_USER_ID } from './preview';

  type Session = { user: { id: string } };

  // Récupère la session via fetch HTTP vers auth.contentos.ch (cookie forwardé).
  // En preview, court-circuite avec le PREVIEW_USER_ID seedé.
  export async function fetchSession(h: Headers): Promise<Session | null> {
    if (isPreview) return { user: { id: PREVIEW_USER_ID } };
    const cookie = h.get('cookie');
    if (!cookie) return null;
    const res = await fetch(`${env.AUTH_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user?.id ? { user: { id: data.user.id } } : null;
  }

  function signInRedirectUrl(): string {
    return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`;
  }

  export async function requireUserId(): Promise<string> {
    const s = await fetchSession(await headers());
    if (!s) redirect(signInRedirectUrl());
    return s.user.id;
  }

  export async function getUserId(): Promise<string | undefined> {
    const s = await fetchSession(await headers());
    return s?.user.id;
  }
  ```

- [ ] **Step 3.2** — Créer `projects/cast/test/unit/auth-session.test.ts` (mocks explicites pour `preview` et `next/headers`, pas de manip d'env qui s'évalue au load) :
  ```ts
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

  // Mock du module preview pour pouvoir flipper isPreview proprement.
  vi.mock('@/lib/auth/preview', () => ({
    isPreview: false,
    PREVIEW_USER_ID: 'preview-user',
    PREVIEW_USER: 'preview@cast.local',
    PREVIEW_OTP: '000000',
  }));
  vi.mock('@/lib/env', () => ({
    env: { AUTH_URL: 'https://auth.example.test', APP_URL: 'https://cast.example.test' },
  }));

  const mockHeaders = (cookie?: string) => {
    const h = new Headers();
    if (cookie) h.set('cookie', cookie);
    return h;
  };

  describe('fetchSession', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('renvoie l\'user quand fetch /api/auth/get-session répond avec un user', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: 'abc123', email: 'manu@avqn.ch' } }),
      });
      vi.stubGlobal('fetch', fetchMock);
      const { fetchSession } = await import('@/lib/auth/session');
      const s = await fetchSession(mockHeaders('better-auth.session_token=xyz'));
      expect(s).toEqual({ user: { id: 'abc123' } });
      expect(fetchMock).toHaveBeenCalledOnce();
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/auth/get-session');
    });

    it('renvoie null quand pas de cookie', async () => {
      const { fetchSession } = await import('@/lib/auth/session');
      expect(await fetchSession(mockHeaders())).toBeNull();
    });

    it('renvoie null quand auth répond non-OK', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
      const { fetchSession } = await import('@/lib/auth/session');
      expect(await fetchSession(mockHeaders('better-auth.session_token=xyz'))).toBeNull();
    });

    it('court-circuite avec PREVIEW_USER_ID quand isPreview=true', async () => {
      vi.doMock('@/lib/auth/preview', () => ({
        isPreview: true,
        PREVIEW_USER_ID: 'preview-user',
        PREVIEW_USER: 'preview@cast.local',
        PREVIEW_OTP: '000000',
      }));
      const { fetchSession } = await import('@/lib/auth/session');
      const s = await fetchSession(mockHeaders());
      expect(s).toEqual({ user: { id: 'preview-user' } });
    });
  });
  ```

- [ ] **Step 3.3** — Lancer les tests :
  ```bash
  cd projects/cast && npm install --no-audit --no-fund && npm test -- auth-session 2>&1 | tail -20
  ```
  Tous verts (4). Si pas encore d'`AUTH_URL` dans `env.ts` : ce test mock `env`, donc OK. Le type-check vs `env.ts` réel reste à régler en Task 5.

- [ ] **Step 3.4** — Commit :
  ```bash
  git add projects/cast/src/lib/auth/session.ts projects/cast/test/unit/auth-session.test.ts
  git commit -m "🔁 cast/session: délègue au fetch SSO + tests"
  ```

---

## Task 4 — Refactor `lib/mcp/auth.ts` côté cast

- [ ] **Step 4.1** — Réécrire complètement `projects/cast/src/lib/mcp/auth.ts` :
  ```ts
  import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
  import { env } from '@/lib/env';
  import { isPreview, PREVIEW_USER_ID } from '@/lib/auth/preview';

  // Valide un bearer MCP via auth.contentos.ch. En preview, court-circuite avec
  // PREVIEW_USER_ID (les outils MCP marchent sans OAuth réel).
  export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
    if (isPreview) {
      return {
        token: 'preview',
        clientId: 'preview',
        scopes: [],
        extra: { userId: PREVIEW_USER_ID },
      };
    }
    const authz = req.headers.get('authorization');
    if (!authz) return undefined;
    const res = await fetch(`${env.AUTH_URL}/api/auth/mcp/get-session`, {
      headers: { authorization: authz },
      cache: 'no-store',
    });
    if (!res.ok) return undefined;
    const session = await res.json();
    if (!session?.userId) return undefined;
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

- [ ] **Step 4.2** — Commit :
  ```bash
  git add projects/cast/src/lib/mcp/auth.ts
  git commit -m "🔁 cast/mcp: valide les bearer via auth.contentos.ch"
  ```

---

## Task 5 — Adapter `lib/env.ts` côté cast (AUTH_URL requis avec garde anti-default)

- [ ] **Step 5.1** — Modifier `projects/cast/src/lib/env.ts`. Edit (le bloc `envSchema` est réécrit en entier puisque plusieurs lignes changent) :
  - old : `const envSchema = z.object({ ... });`
  - new :
    ```ts
    const envSchema = z.object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      APP_URL: z.string().url(),
      DATABASE_URL: z.string().url(),
      REDIS_URL: z.string().url(),
      // URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
      // En preview, isPreview court-circuite tout fetch vers auth.
      AUTH_URL: z.string().url().default('https://auth.contentos.ch'),
      LINKEDIN_CLIENT_ID: z.string().optional(),
      LINKEDIN_CLIENT_SECRET: z.string().optional(),
      TOKEN_ENCRYPTION_KEY: z.string().optional(),
      CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
      MEDIA_ENGINE_URL: z.string().optional(),
      MEDIA_ENGINE_SERVICE_KEY: z.string().optional(),
      LINKEDIN_API_VERSION: z.string().default('202604'),
      E2E_TESTING: z.string().optional(),
      // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
      APP_ENV: z.string().optional(),
    });
    ```

- [ ] **Step 5.2** — Vérifier qu'aucun test n'importe les variables retirées :
  ```bash
  grep -rn 'BETTER_AUTH_SECRET\|RESEND_API_KEY\|RESEND_FROM' projects/cast/src projects/cast/test 2>&1 | head -10
  ```
  Si reste : adapter ou supprimer le test. Le seul hit attendu est dans `src/lib/auth/server.ts` (à supprimer en Task 7) et `src/lib/email/*` (à supprimer en Task 7).

- [ ] **Step 5.3** — Commit :
  ```bash
  git add projects/cast/src/lib/env.ts
  git commit -m "🧹 cast/env: ajoute AUTH_URL, retire BETTER_AUTH_SECRET + RESEND"
  ```

---

## Task 6 — Refactor middleware `proxy.ts` + page `/signin` + preview-login + .well-known

- [ ] **Step 6.1** — Réécrire `projects/cast/src/proxy.ts` :
  ```ts
  import { type NextRequest, NextResponse } from 'next/server';
  import { env } from '@/lib/env';
  import { isPreview } from '@/lib/auth/preview';

  export async function proxy(request: NextRequest): Promise<NextResponse> {
    if (isPreview) return NextResponse.next();
    const cookie = request.headers.get('cookie') ?? '';
    // Cookie posé par auth.contentos.ch (cross-subdomain .contentos.ch).
    const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
    if (!hasSession) {
      const dest = `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(request.url)}`;
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  export const config = {
    matcher: [
      '/((?!healthz|signin|oauth|\\.well-known|api/auth|api/mcp|api/preview-login|api/__test__|_next|favicon).*)',
    ],
  };
  ```

- [ ] **Step 6.2** — Réécrire `projects/cast/src/app/(auth)/signin/page.tsx` :
  ```tsx
  import { redirect } from 'next/navigation';
  import { env } from '@/lib/env';
  import { isPreview } from '@/lib/auth/preview';

  export default function SignInPage() {
    if (isPreview) {
      // En preview, le auto-login se déclenche via GET /api/preview-login.
      redirect('/api/preview-login?redirect=/');
    }
    redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`);
  }
  ```

- [ ] **Step 6.3** — Réécrire `projects/cast/src/app/api/preview-login/route.ts` :
  ```ts
  import { isPreview } from '@/lib/auth/preview';

  // En preview, `session.ts` court-circuite avec PREVIEW_USER_ID sans cookie ;
  // ce handler reste juste pour préserver les liens existants vers /api/preview-login.
  export async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const raw = url.searchParams.get('redirect') || '/';
    const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    if (!isPreview) {
      return new Response(null, { status: 302, headers: { Location: '/signin' } });
    }
    return new Response(null, { status: 302, headers: { Location: target } });
  }
  ```

- [ ] **Step 6.4** — Réécrire `projects/cast/src/app/.well-known/oauth-authorization-server/route.ts` :
  ```ts
  import { env } from '@/lib/env';

  // Délègue la découverte OAuth aux clients vers le provider central.
  export function GET(): Response {
    return new Response(null, {
      status: 302,
      headers: { Location: `${env.AUTH_URL}/.well-known/oauth-authorization-server` },
    });
  }
  ```

- [ ] **Step 6.5** — Réécrire `projects/cast/src/app/.well-known/oauth-protected-resource/route.ts` :
  ```ts
  import { env } from '@/lib/env';

  // Cast est une ressource protégée par OAuth du provider central.
  export function GET(): Response {
    return Response.json({
      resource: env.APP_URL,
      authorization_servers: [env.AUTH_URL],
      bearer_methods_supported: ['header'],
    });
  }
  ```

- [ ] **Step 6.6** — Supprimer `projects/cast/src/app/(auth)/signin/otp-form.tsx` (devenu inutile) :
  ```bash
  git rm projects/cast/src/app/\(auth\)/signin/otp-form.tsx
  ```

- [ ] **Step 6.7** — Commit :
  ```bash
  git add projects/cast/src/proxy.ts \
          projects/cast/src/app/\(auth\)/signin/page.tsx \
          projects/cast/src/app/api/preview-login/route.ts \
          projects/cast/src/app/.well-known/oauth-authorization-server/route.ts \
          projects/cast/src/app/.well-known/oauth-protected-resource/route.ts
  git commit -m "🔁 cast: middleware cookie-gate + signin redirect + .well-known délégué"
  ```

---

## Task 7 — Réécrire les consumers directs de `auth.api.getSession` et `authClient`

Tous les fichiers qui appelaient `auth.api.getSession({ headers: await headers() })` directement passent par `requireUserId()` (qui rend exactement le `user.id` requis) ou `getUserId()`. Le composant client `app-header.tsx` qui faisait `authClient.signOut()` redirige plutôt vers la page d'auth (sign-out géré côté SSO).

- [ ] **Step 7.1** — Edit `projects/cast/src/app/(app)/layout.tsx`. Remplacer :
  - old :
    ```
    import { headers } from 'next/headers';
    import { redirect } from 'next/navigation';
    import { auth } from '@/lib/auth/server';
    ```
    et le bloc qui appelle `auth.api.getSession({headers})`. Pattern à substituer :
    ```ts
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect('/signin');
    ```
  - new : remplacer par
    ```ts
    import { requireUserId } from '@/lib/auth/session';
    // ...
    const userId = await requireUserId();
    ```
    Et si plus loin le code utilisait `session.user.id`, utiliser `userId` à la place. Si `session.user` était passé en prop (nom/email) : adapter en passant juste `userId` ; les composants UI doivent récupérer le reste eux-mêmes (ou ne pas l'afficher si non disponible).

- [ ] **Step 7.2** — Même substitution pour `projects/cast/src/app/(app)/page.tsx` et `projects/cast/src/app/(settings)/layout.tsx`. Vérifier après chaque edit que les imports `auth` et `headers`/`redirect` orphelins sont supprimés.

- [ ] **Step 7.3** — Vérifier les imports résiduels :
  ```bash
  grep -rn "from '@/lib/auth/server'" projects/cast/src 2>&1 | head -10
  ```
  Doit ne plus rien retourner sauf les fichiers à supprimer en Task 8 (`api/auth/[...all]/route.ts`, etc.). Sinon, adapter le fichier listé.

- [ ] **Step 7.4** — Réécrire `projects/cast/src/components/layout/app-header.tsx` pour ne plus dépendre d'`authClient`. Le bouton "Se déconnecter" devient un simple `<a href={authUrl}>` qui mène à la page d'accueil d'auth (où l'user peut se déconnecter). `authUrl` est passé en prop par le parent server-component (qui lit `env.AUTH_URL`).

  Edit `src/components/layout/app-header.tsx`. Supprimer l'import `import { authClient } from '@/lib/auth/client';` et tout usage de `authClient.signOut()` et `router.push('/signin')` lié à la déconnexion. Ajouter une prop `authUrl: string` au composant et remplacer le handler signOut par :
  ```tsx
  <a
    href={authUrl}
    className={/* mêmes classes que le bouton actuel */}
  >
    Se déconnecter
  </a>
  ```
  (Si le composant utilisait `useRouter` uniquement pour cette redirection : supprimer aussi l'import et l'usage.)

- [ ] **Step 7.5** — Mettre à jour les call-sites de `app-header.tsx` (probablement `src/app/(app)/layout.tsx` et `src/app/(settings)/layout.tsx`). Passer la prop `authUrl={env.AUTH_URL}` (avec `import { env } from '@/lib/env';`).

- [ ] **Step 7.6** — Vérifier qu'aucun import `@/lib/auth/client` ne subsiste :
  ```bash
  grep -rn "from '@/lib/auth/client'\|authClient" projects/cast/src 2>&1
  ```
  Doit ne plus rien retourner.

- [ ] **Step 7.7** — Commit :
  ```bash
  git add projects/cast/src/app/\(app\)/layout.tsx projects/cast/src/app/\(app\)/page.tsx \
          projects/cast/src/app/\(settings\)/layout.tsx \
          projects/cast/src/components/layout/app-header.tsx
  git commit -m "🔁 cast: consumers utilisent requireUserId + app-header sign-out via auth"
  ```

---

## Task 8 — Supprimer auth local + email côté cast (fichiers + tests)

- [ ] **Step 8.1** — Supprimer les fichiers d'auth local + l'endpoint /api/auth :
  ```bash
  git rm projects/cast/src/lib/auth/server.ts \
         projects/cast/src/lib/auth/client.ts \
         projects/cast/src/app/api/auth/\[...all\]/route.ts
  ```

- [ ] **Step 8.2** — Supprimer email/ et ses consumers (route test + test unitaire) :
  ```bash
  git rm -r projects/cast/src/lib/email/
  git rm projects/cast/src/app/api/__test__/emails/route.ts
  git rm projects/cast/test/unit/email.test.ts
  ```

- [ ] **Step 8.3** — Vérifier qu'aucun import orphelin ne subsiste :
  ```bash
  grep -rn "from .*lib/email\|from .*lib/auth/server\|from .*lib/auth/client" projects/cast 2>&1 | head -10
  ```
  Aucune ligne attendue. Sinon adapter.

- [ ] **Step 8.4** — Vérifier que `seedUserDefaults` n'est plus appelé nulle part :
  ```bash
  grep -rn 'seedUserDefaults' projects/cast/src 2>&1
  ```
  Si seul `src/lib/db/seeds/user-defaults.ts` ressort : `git rm projects/cast/src/lib/db/seeds/user-defaults.ts`. S'il est encore appelé par un autre service/worker : laisser, sans rien faire ici.

- [ ] **Step 8.5** — Adapter `projects/cast/lab.json` (retire `email: true`) :
  ```json
  {
    "description": "Cast — atelier de publication LinkedIn (suite contentos), web + worker.",
    "db": true,
    "redis": true,
    "migrate": "node scripts/migrate.mjs",
    "worker": "node worker-runner.mjs",
    "images": ["web", "worker"]
  }
  ```

- [ ] **Step 8.6** — Smoke build cast :
  ```bash
  cd projects/cast && npm run build 2>&1 | tail -20
  ```
  **Attendu** : `Compiled successfully`. Si erreurs : corriger inline (probablement un import oublié de Task 7).

- [ ] **Step 8.7** — Commit :
  ```bash
  git add projects/cast/ && git commit -m "🧹 cast: supprime auth/email locaux + lab.json sans email"
  ```

---

## Task 9 — Drop schémas auth+oidc + migration DROP idempotente

- [ ] **Step 9.1** — Supprimer les schémas :
  ```bash
  git rm projects/cast/src/lib/db/schemas/auth.ts \
         projects/cast/src/lib/db/schemas/oidc.ts
  ```

- [ ] **Step 9.2** — Edit `projects/cast/src/lib/db/schema.ts`. Retirer les deux lignes :
  - old :
    ```
    export * from './schemas/auth';
    export * from './schemas/ideas';
    export * from './schemas/oidc';
    export * from './schemas/posts';
    ```
  - new :
    ```
    export * from './schemas/ideas';
    export * from './schemas/posts';
    ```

- [ ] **Step 9.3** — Créer `projects/cast/drizzle/0025_drop_auth_oidc.sql` :
  ```sql
  -- Drop tables auth+OIDC : cast n'héberge plus de session ni d'OAuth.
  -- La SSO est désormais centralisée dans auth.contentos.ch.
  -- DROP IF EXISTS : idempotent (base preview persistante).

  DROP TABLE IF EXISTS "oauth_consent" CASCADE;
  DROP TABLE IF EXISTS "oauth_access_token" CASCADE;
  DROP TABLE IF EXISTS "oauth_application" CASCADE;
  DROP TABLE IF EXISTS "verification" CASCADE;
  DROP TABLE IF EXISTS "account" CASCADE;
  DROP TABLE IF EXISTS "session" CASCADE;
  DROP TABLE IF EXISTS "user" CASCADE;
  ```

- [ ] **Step 9.4** — Edit `projects/cast/drizzle/meta/_journal.json` pour ajouter l'entrée 25. Le `when` doit être > `1779908229465` (dernière entrée). Utiliser `Date.now()` actuel — vérifier qu'il est strictement supérieur. Edit avant la fermeture `]` du tableau `entries` :
  - old :
    ```
        {
          "idx": 24,
          "version": "7",
          "when": 1779908229465,
          "tag": "0024_natural_menace",
          "breakpoints": true
        }
      ]
    }
    ```
  - new :
    ```
        {
          "idx": 24,
          "version": "7",
          "when": 1779908229465,
          "tag": "0024_natural_menace",
          "breakpoints": true
        },
        {
          "idx": 25,
          "version": "7",
          "when": <DATE_NOW_MS>,
          "tag": "0025_drop_auth_oidc",
          "breakpoints": true
        }
      ]
    }
    ```
  Remplacer `<DATE_NOW_MS>` par `node -e "console.log(Date.now())"` (un nombre > 1779908229465).

- [ ] **Step 9.5** — Smoke build cast :
  ```bash
  cd projects/cast && npm run build 2>&1 | tail -10
  ```
  Doit passer.

- [ ] **Step 9.6** — Commit :
  ```bash
  git add projects/cast/src/lib/db/ projects/cast/drizzle/
  git commit -m "🗑️ cast: drop schémas auth+oidc + migration DROP idempotente"
  ```

---

## Task 10 — Script migration data en prod (one-shot manuel)

- [ ] **Step 10.1** — Créer `projects/cast/scripts/sso-migrate-user.mjs` :
  ```js
  // One-shot manuel : re-mappe l'ancien user.id de cast vers ton nouveau user.id
  // côté auth.contentos.ch. Le DROP des tables locales est fait par la migration
  // Drizzle au déploiement — ce script ne fait QUE le remap des FK.
  //
  // Usage (depuis lab via lab-ssh) :
  //   docker exec cast-prod-web-1 node scripts/sso-migrate-user.mjs <NEW_USER_ID>
  //
  // NEW_USER_ID = id de Manu dans la table user de auth.contentos.ch, obtenu après
  // login OTP. Exemple :
  //   docker exec lab-platform-postgres-1 psql -U postgres -d auth_prod \
  //     -c "SELECT id FROM \"user\" WHERE email='manu@avqn.ch';"
  //
  // IMPORTANT : exécuter AVANT que la migration drizzle 0025 ne drop la table user.
  // Donc avant de déployer la PR. Si déjà déployée, la table user est tombée et
  // le script ne peut plus lire OLD_ID : il faut récupérer OLD_ID depuis un dump
  // ou un backup.

  import postgres from 'postgres';

  const NEW = process.argv[2];
  if (!NEW) {
    console.error('usage: node sso-migrate-user.mjs <NEW_USER_ID>');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL manquant');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    // Vérifie qu'il existe encore une table user (i.e., migration 0025 pas encore appliquée).
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`;
    if (tables.length === 0) {
      console.error('Refus : table "user" inexistante. La migration drop a déjà été appliquée — récupérer OLD_ID depuis un backup.');
      process.exit(1);
    }
    const users = await sql`SELECT id, email FROM "user"`;
    if (users.length === 0) {
      console.log('Aucun user local — rien à migrer.');
      process.exit(0);
    }
    if (users.length > 1) {
      console.error(`Refus : ${users.length} users locaux. Adapter le script pour mapping multiple.`);
      process.exit(1);
    }
    const OLD = users[0].id;
    console.log(`Migration OLD=${OLD} (${users[0].email}) → NEW=${NEW}`);

    await sql.begin(async (t) => {
      const tables = [
        'posts',
        'ideas',
        'voice',
        'settings',
        'publications',
        'social_accounts',
        'writing_templates',
      ];
      for (const tbl of tables) {
        const r = await t.unsafe(`UPDATE "${tbl}" SET user_id = $1 WHERE user_id = $2`, [NEW, OLD]);
        console.log(`  ${tbl}: ${r.count} lignes`);
      }
    });
    console.log('Migration FK OK. Le prochain déploiement appliquera le DROP des tables auth locales.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
  ```

- [ ] **Step 10.2** — Commit :
  ```bash
  git add projects/cast/scripts/sso-migrate-user.mjs
  git commit -m "📜 cast: script sso-migrate-user.mjs (one-shot prod)"
  ```

---

## Task 11 — CLAUDE.md de cast réécrit (instantané, pas patch)

- [ ] **Step 11.1** — Édit ciblé du `projects/cast/CLAUDE.md` :

  Edit A — section "Stack". Remplacer le paragraphe :
  - old :
    ```
    **Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres,
    schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **better-auth**
    (`BETTER_AUTH_SECRET`, plugin MCP/OAuth) + **BullMQ + ioredis**. Migrations SQL committées
    dans `drizzle/`, appliquées au déploiement par le one-shot `scripts/migrate.mjs`
    (`drizzle-orm/node-postgres`, deps de prod — pas de drizzle-kit). `GET /healthz` → `ok` sans DB.
    ```
  - new :
    ```
    **Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `pg`/node-postgres,
    schéma `src/lib/db/schema.ts`, client paresseux `src/lib/db/client.ts`) + **BullMQ + ioredis**.
    Sessions web et OAuth/OIDC du MCP délégués à **`auth.contentos.ch`** (cookie cross-subdomain
    `.contentos.ch`) — `src/lib/auth/session.ts` lit la session via fetch HTTP, `src/lib/mcp/auth.ts`
    valide les bearer MCP via `${AUTH_URL}/api/auth/mcp/get-session`. Voir
    `docs/superpowers/specs/2026-05-28-cast-sso-migration-design.md`. Migrations SQL committées
    dans `drizzle/`, appliquées au déploiement par le one-shot `scripts/migrate.mjs`
    (`drizzle-orm/node-postgres`, deps de prod — pas de drizzle-kit). `GET /healthz` → `ok` sans DB.
    ```

  Edit B — section "Données & secrets". Remplacer la liste des secrets :
  - old :
    ```
    Les autres secrets viennent du coffre `cast` de l'atelier (`/lab-secret`, scope `cast`),
    déchiffrés et injectés par `deploy.sh` :

    - `BETTER_AUTH_SECRET` — signature des sessions (≥ 16 car. ; `openssl rand -base64 32`)
    - `RESEND_API_KEY`, `RESEND_FROM` — email (sinon OTP loggé côté serveur)
    - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` — publication LinkedIn
    - `TOKEN_ENCRYPTION_KEY` — chiffrement des tokens LinkedIn stockés
    - `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY` — service **media** (`https://media.contentos.ch`) :
      lecture du catalogue (`GET /v1/media`) pour le picker, et fetch des octets pour la publication
    - `QUEUE_PREFIX` — défaut `cast` (à laisser tel quel sauf collision)
    - stubs CI/dev : `CONTENT_OS_AI_STUB`, `CONTENT_OS_LINKEDIN_STUB`
    ```
  - new :
    ```
    Les autres secrets viennent du coffre `cast` de l'atelier (`/lab-secret`, scope `cast`),
    déchiffrés et injectés par `deploy.sh` :

    - `AUTH_URL` — URL du provider d'auth de la suite (défaut `https://auth.contentos.ch`).
    - `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` — publication LinkedIn
    - `TOKEN_ENCRYPTION_KEY` — chiffrement des tokens LinkedIn stockés
    - `MEDIA_ENGINE_URL`, `MEDIA_ENGINE_SERVICE_KEY` — service **media** (`https://media.contentos.ch`) :
      lecture du catalogue (`GET /v1/media`) pour le picker, et fetch des octets pour la publication
    - `QUEUE_PREFIX` — défaut `cast` (à laisser tel quel sauf collision)
    - stubs CI/dev : `CONTENT_OS_AI_STUB`, `CONTENT_OS_LINKEDIN_STUB`
    ```

- [ ] **Step 11.2** — Commit :
  ```bash
  git add projects/cast/CLAUDE.md
  git commit -m "📝 cast: CLAUDE.md — SSO délégué à auth.contentos.ch"
  ```

---

## Task 12 — Smoke build complet + nettoyage secrets + push + PR

- [ ] **Step 12.1** — Smoke build des deux projets :
  ```bash
  cd projects/auth && npm run build 2>&1 | tail -15
  cd ../cast && npm run build 2>&1 | tail -15
  ```
  Les deux verts.

- [ ] **Step 12.2** — Tests cast :
  ```bash
  cd projects/cast && npm test 2>&1 | tail -30
  ```
  Tous verts. Si certains tests touchaient `auth/server.ts` ou `email/` (supprimés) : adapter ou supprimer.

- [ ] **Step 12.3** — Retirer les secrets obsolètes du coffre cast :
  ```bash
  cd /Users/ManuAVQN/Code/atelier/.claude/worktrees/cast-sso-migration
  set -a; . /Users/ManuAVQN/Code/atelier/.env; set +a
  bin/lab-secret rm cast BETTER_AUTH_SECRET 2>&1 | tail -3
  bin/lab-secret rm cast RESEND_API_KEY 2>&1 | tail -3
  bin/lab-secret rm cast RESEND_FROM 2>&1 | tail -3
  ```
  Chacun crée un commit `🔐 secret: rm cast/...` sur la branche courante. Si un secret n'existe pas, lab-secret loggue mais n'échoue pas.

- [ ] **Step 12.4** — Push :
  ```bash
  git push -u origin work/cast-sso-migration 2>&1 | tail -10
  ```

- [ ] **Step 12.5** — Watch CI :
  ```bash
  sleep 8 && gh run watch "$(gh run list -L1 --json databaseId -q '.[0].databaseId')" --exit-status 2>&1 | tail -30
  ```
  Verte attendue. Si rouge : `gh run view ... --log-failed` et corriger.

- [ ] **Step 12.6** — Smoke preview :
  ```bash
  BR=work-cast-sso-migration
  curl -sI -o /dev/null -w "auth /  : %{http_code}\n" -L https://auth-$BR.preview.contentos.ch/
  curl -sI -o /dev/null -w "cast /  : %{http_code}\n" -L https://cast-$BR.preview.contentos.ch/
  curl -sI -o /dev/null -w "cast /healthz : %{http_code}\n" -L https://cast-$BR.preview.contentos.ch/healthz
  curl -sS https://cast-$BR.preview.contentos.ch/.well-known/oauth-protected-resource
  ```
  Tous 200 (sauf le dernier qui renvoie un JSON avec `authorization_servers` pointant vers `auth-$BR.preview.contentos.ch` ou la prod).

- [ ] **Step 12.7** — Ouvrir la PR avec `gh pr create --title "🔁 cast → SSO auth.contentos.ch (+ ajoute mcp() à auth)"`. Description : périmètre + runbook prod (voir ci-dessous).

---

## Hors plan : runbook post-merge en prod (à faire manuellement par Manu)

⚠️ **Ordre crucial** : déployer la PR drop la table `user` côté cast — donc faire la migration data **AVANT** que la migration drizzle 0025 ne s'applique. Le script refuse de tourner si la table `user` est déjà droppée (garde explicite).

Le flux recommandé :
1. **Merger la PR** → CI déclenche le déploiement prod de cast (migrate inclus).
2. La migration drizzle 0025 va dropper la table `user` AVANT le démarrage de l'app — c'est trop tard pour lire OLD_ID. **Donc en pratique, avant de merger, ouvrir un PSQL en prod et noter OLD_ID** :
   ```bash
   set -a; . /Users/ManuAVQN/Code/atelier/.env; set +a
   bin/lab-ssh "docker exec lab-platform-postgres-1 psql -U postgres -d cast_prod -t -c 'SELECT id, email FROM \"user\";'"
   ```
   Noter `OLD_ID`.
3. **Login sur `https://auth.contentos.ch/sign-in`** avec ton email → reçois l'OTP par email → connecté. (Si `auth_prod` n'a aucun user, le user est créé à ce login.)
4. **Récupérer NEW_ID** :
   ```bash
   bin/lab-ssh "docker exec lab-platform-postgres-1 psql -U postgres -d auth_prod -t -c \"SELECT id FROM \\\"user\\\" WHERE email='manu@avqn.ch';\""
   ```
5. **Migrer les FK avant le merge** (cast est encore sur l'ancien code, table user encore présente) :
   ```bash
   bin/lab-ssh "docker exec cast-prod-web-1 sh -c 'cd /app && node -e \"
     const postgres = require(\\\"postgres\\\");
     const sql = postgres(process.env.DATABASE_URL, { max: 1 });
     (async () => {
       await sql.begin(async t => {
         for (const tbl of [\\\"posts\\\",\\\"ideas\\\",\\\"voice\\\",\\\"settings\\\",\\\"publications\\\",\\\"social_accounts\\\",\\\"writing_templates\\\"]) {
           const r = await t.unsafe(\\\`UPDATE \\\\\\\"\\\${tbl}\\\\\\\" SET user_id = \\\$1 WHERE user_id = \\\$2\\\`, [\\\"<NEW_ID>\\\", \\\"<OLD_ID>\\\"]);
           console.log(tbl, r.count);
         }
       });
       await sql.end();
     })();
   \"'"
   ```
   *(Le script `sso-migrate-user.mjs` n'est dispo qu'après merge — d'où ce one-liner.)*
6. **Merger la PR** → déploiement, drizzle 0025 drop les tables auth locales.
7. **Vérifier** :
   ```bash
   curl -sI -o /dev/null -w "%{http_code} %{redirect_url}\n" https://cast.contentos.ch/
   # Attendu : 307/302 redirect vers https://auth.contentos.ch/sign-in?redirect=...
   ```
   Puis ouvrir le navigateur → redirect → OTP → revient sur cast connecté.
8. **Tester la création d'un post** → `posts.user_id` = NEW_ID.

Alternative plus sûre (si tu veux que le script handle tout) : faire deux PRs séparées — d'abord la PR sans le DROP (migration 0025 absente), Migrer les FK avec `sso-migrate-user.mjs`, puis une seconde PR pour le DROP. Mais le contrat de cette mission est "tout dans une PR" — donc on fait le one-liner ci-dessus.
