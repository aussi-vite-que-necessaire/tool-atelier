# Seed preview + opérateurs de test + connexion réelle — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En preview (jamais en prod), seeder des données pour deux opérateurs + un abonné, et remplacer le court-circuit d'auth par une vraie connexion auto (user1) avec déconnexion → choix user1/user2/user3.

**Architecture:** L'auth de preview (par branche) seede 3 users et expose `/preview-login` (ouvre une vraie session BetterAuth) + `/preview-logout` (efface + pose un marqueur). Les clients suppriment leur court-circuit et redirigent les visiteurs sans session vers auto-login (marqueur absent) ou chooser (marqueur présent), via un helper pur testé. `deploy.sh` injecte `AUTH_URL` par branche en preview. Les seeds créent des données pour les deux opérateurs + l'abonné.

**Tech Stack:** Next.js 16, BetterAuth 1.6, Drizzle ORM (Postgres), bash (deploy.sh), Node/tsx (seeds).

**Convention d'identités (dupliquée à l'identique partout) :**

| Rôle | id | email | accountType | défaut auto-login |
|---|---|---|---|---|
| Op 1 | `preview-op-1` | `user1@avqn.ch` | `operator` | ressources/media/cast |
| Op 2 | `preview-op-2` | `user2@avqn.ch` | `operator` | — |
| Audience 3 | `preview-aud-3` | `user3@avqn.ch` | `audience` | docs |

Marqueur logout : cookie `cos_preview_login=manual`, domaine `.preview.contentos.ch`.

---

## Task 1 : auth — module d'identités preview

**Files:**
- Create: `projects/auth/src/lib/preview-users.ts`

- [ ] **Step 1: Créer le module d'identités**

```ts
// projects/auth/src/lib/preview-users.ts
// Identités de test, preview uniquement (jamais prod). Convention partagée avec
// les seeds clients (ressources/media/cast) : mêmes id/email/accountType.
export type PreviewUser = {
  id: string;
  email: string;
  name: string;
  accountType: "operator" | "audience";
};

export const PREVIEW_USERS: Record<"1" | "2" | "3", PreviewUser> = {
  "1": { id: "preview-op-1", email: "user1@avqn.ch", name: "User 1 (preview)", accountType: "operator" },
  "2": { id: "preview-op-2", email: "user2@avqn.ch", name: "User 2 (preview)", accountType: "operator" },
  "3": { id: "preview-aud-3", email: "user3@avqn.ch", name: "User 3 (preview)", accountType: "audience" },
};

export const PREVIEW_MARKER_COOKIE = "cos_preview_login";
export const PREVIEW_COOKIE_DOMAIN = ".preview.contentos.ch";
```

- [ ] **Step 2: Commit**

```bash
git add projects/auth/src/lib/preview-users.ts
git commit -m "auth: module d'identités de preview (3 users)"
```

---

## Task 2 : auth — seed des 3 users (preview only)

**Files:**
- Modify: `projects/auth/scripts/seed.mjs`

- [ ] **Step 1: Réécrire le seed**

Note : `seed.mjs` est du JS pur (lancé par `node`). On duplique les valeurs (gardées en phase avec `src/lib/preview-users.ts` par convention, documentée en tête).

```js
// projects/auth/scripts/seed.mjs
// Seed preview uniquement (jamais prod). Insère les 3 users de test de la suite.
// Valeurs à garder EN PHASE avec src/lib/preview-users.ts (pas d'import : JS pur).
import postgres from "postgres";

const appEnv = process.env.APP_ENV;
if (appEnv === "prod") {
  console.log("seed: APP_ENV=prod → aucun user de test (refusé).");
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("seed: DATABASE_URL absent — rien à faire");
  process.exit(0);
}

const USERS = [
  { id: "preview-op-1", email: "user1@avqn.ch", name: "User 1 (preview)", accountType: "operator" },
  { id: "preview-op-2", email: "user2@avqn.ch", name: "User 2 (preview)", accountType: "operator" },
  { id: "preview-aud-3", email: "user3@avqn.ch", name: "User 3 (preview)", accountType: "audience" },
];

const sql = postgres(url, { max: 1 });
try {
  for (const u of USERS) {
    await sql`
      INSERT INTO "user" (id, name, email, email_verified, account_type, created_at, updated_at)
      VALUES (${u.id}, ${u.name}, ${u.email}, true, ${u.accountType}, now(), now())
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, name = EXCLUDED.name,
            email_verified = true, account_type = EXCLUDED.account_type, updated_at = now()
    `;
  }
  console.log(`seed: ${USERS.length} users de preview assurés (op1, op2, aud3).`);
} catch (e) {
  console.error("seed: erreur —", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
```

- [ ] **Step 2: Vérifier la garde anti-prod**

Run: `cd projects/auth && APP_ENV=prod node scripts/seed.mjs`
Expected: affiche « APP_ENV=prod → aucun user de test (refusé). » et exit 0, sans toucher la DB.

- [ ] **Step 3: Commit**

```bash
git add projects/auth/scripts/seed.mjs
git commit -m "auth: seed des 3 users de preview (garde anti-prod)"
```

---

## Task 3 : auth — routes preview-login / preview-logout

**Files:**
- Create: `projects/auth/src/app/preview-login/route.ts`
- Create: `projects/auth/src/app/preview-logout/route.ts`

D'abord vérifier l'API serveur BetterAuth disponible :

Run: `cd projects/auth && node -e "const a=require('better-auth');console.log('ok')"` puis inspecter `node_modules/better-auth/dist` pour confirmer `auth.api.signInEmailOTP`, `auth.api.sendVerificationOTP`, `auth.api.signOut`. Ajuster les noms si l'API diffère.

- [ ] **Step 1: route preview-login**

```ts
// projects/auth/src/app/preview-login/route.ts
import { auth } from "@/lib/auth";
import { isPreview } from "@/lib/auth-preview";
import { PREVIEW_USERS } from "@/lib/preview-users";
import { PREVIEW_OTP } from "@/lib/auth-preview";

export const dynamic = "force-dynamic";

function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw);
    if (u.hostname === "contentos.ch") return raw;
    if (u.hostname.endsWith(".contentos.ch")) return raw;
    if (u.hostname.endsWith(".preview.contentos.ch")) return raw;
    return "/";
  } catch {
    return "/";
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = safeRedirect(url.searchParams.get("redirect"));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: "/sign-in" } });
  }
  const key = url.searchParams.get("user") ?? "1";
  const u = PREVIEW_USERS[key as "1" | "2" | "3"];
  if (!u) return new Response(null, { status: 302, headers: { Location: "/sign-in" } });

  // Code OTP forcé à 000000 en preview (cf. auth.ts generateOTP). On le pose puis on le vérifie.
  await auth.api.sendVerificationOTP({ body: { email: u.email, type: "sign-in" } });
  const signed = await auth.api.signInEmailOTP({
    body: { email: u.email, otp: PREVIEW_OTP },
    asResponse: true,
  });

  const headers = new Headers({ Location: target });
  for (const cookie of signed.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}
```

- [ ] **Step 2: route preview-logout**

```ts
// projects/auth/src/app/preview-logout/route.ts
import { auth } from "@/lib/auth";
import { isPreview } from "@/lib/auth-preview";
import { PREVIEW_MARKER_COOKIE, PREVIEW_COOKIE_DOMAIN } from "@/lib/preview-users";

export const dynamic = "force-dynamic";

function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw);
    if (u.hostname === "contentos.ch" || u.hostname.endsWith(".contentos.ch")) return raw;
    return "/";
  } catch {
    return "/";
  }
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const back = safeRedirect(url.searchParams.get("redirect"));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: "/sign-in" } });
  }
  const cleared = await auth.api.signOut({ headers: req.headers, asResponse: true });
  // Après logout → chooser, en gardant la cible pour le retour.
  const location = `/sign-in?redirect=${encodeURIComponent(back)}`;
  const headers = new Headers({ Location: location });
  for (const cookie of cleared.headers.getSetCookie()) headers.append("set-cookie", cookie);
  // Marqueur suite-wide : tant qu'il est là, les clients montrent le chooser (plus d'auto-login).
  headers.append(
    "set-cookie",
    `${PREVIEW_MARKER_COOKIE}=manual; Domain=${PREVIEW_COOKIE_DOMAIN}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}
```

- [ ] **Step 3: Build de contrôle**

Run: `cd projects/auth && npm run build`
Expected: build OK (types valides). Corriger les noms d'API BetterAuth si erreur de type.

- [ ] **Step 4: Commit**

```bash
git add projects/auth/src/app/preview-login/route.ts projects/auth/src/app/preview-logout/route.ts
git commit -m "auth: routes preview-login / preview-logout (preview only)"
```

---

## Task 4 : auth — boutons de connexion rapide sur /sign-in (preview)

**Files:**
- Modify: `projects/auth/src/app/sign-in/page.tsx`

- [ ] **Step 1: Ajouter les boutons rapides + pose du marqueur**

Dans `SignInForm`, après le `<h1>`, insérer (préserver le `safeRedirect()` existant) :

```tsx
// En haut du composant, calculer la cible une fois :
const redirectParam = searchParams.get("redirect");
const rq = redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : "";
const isPreviewClient = typeof window !== "undefined"
  && window.location.hostname.endsWith(".preview.contentos.ch");

// Pose le marqueur dès qu'on est sur le chooser en preview (plus d'auto-login tant qu'il est là).
useEffect(() => {
  if (isPreviewClient) {
    document.cookie = "cos_preview_login=manual; Domain=.preview.contentos.ch; Path=/; Max-Age=31536000; Secure; SameSite=Lax";
  }
}, [isPreviewClient]);
```

```tsx
{isPreviewClient && (
  <section className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
    <p className="text-center text-xs uppercase tracking-wide text-zinc-400">Connexion rapide (preview)</p>
    <a className={btn + " block text-center"} href={`/preview-login?user=1${rq}`}>Entrer comme user1 (operator)</a>
    <a className={btn + " block text-center"} href={`/preview-login?user=2${rq}`}>Entrer comme user2 (operator)</a>
    <a className={btn + " block text-center"} href={`/preview-login?user=3${rq}`}>Entrer comme user3 (audience)</a>
  </section>
)}
```

Ajouter `useEffect` à l'import React (`import { Suspense, useState, useEffect } from "react";`).

- [ ] **Step 2: Build de contrôle**

Run: `cd projects/auth && npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add projects/auth/src/app/sign-in/page.tsx
git commit -m "auth: chooser de connexion rapide user1/2/3 en preview"
```

---

## Task 5 : clients — helper de redirection pur + tests (gabarit ressources)

Ce helper est ajouté **dans chaque** projet client (ressources, docs, media, cast),
au même endroit que `preview.ts`. On le teste une fois (ressources) ; les copies
sont identiques. Chemins de `preview.ts` :
- ressources : `projects/ressources/lib/auth/preview.ts`
- docs : `projects/docs/lib/auth/preview.ts`
- media : `projects/media/src/lib/auth/preview.ts`
- cast : `projects/cast/src/lib/auth/preview.ts`

**Files (ressources, gabarit) :**
- Modify: `projects/ressources/lib/auth/preview.ts`
- Test: `projects/ressources/lib/auth/preview.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
// projects/ressources/lib/auth/preview.test.ts
import { describe, it, expect } from "vitest"
import { hasManualMarker, loginRedirect } from "./preview"

describe("hasManualMarker", () => {
  it("détecte le marqueur", () => {
    expect(hasManualMarker("a=1; cos_preview_login=manual; b=2")).toBe(true)
  })
  it("absent quand pas de cookie", () => {
    expect(hasManualMarker(null)).toBe(false)
    expect(hasManualMarker("foo=bar")).toBe(false)
  })
})

describe("loginRedirect", () => {
  const base = { authUrl: "https://auth-x.preview.contentos.ch", back: "https://app-x.preview.contentos.ch/admin", defaultUser: 1 as const }
  it("prod → /sign-in", () => {
    expect(loginRedirect({ ...base, preview: false, cookieHeader: null }))
      .toBe(`https://auth-x.preview.contentos.ch/sign-in?redirect=${encodeURIComponent(base.back)}`)
  })
  it("preview sans marqueur → auto-login user défaut", () => {
    expect(loginRedirect({ ...base, preview: true, cookieHeader: null }))
      .toBe(`https://auth-x.preview.contentos.ch/preview-login?user=1&redirect=${encodeURIComponent(base.back)}`)
  })
  it("preview avec marqueur → chooser", () => {
    expect(loginRedirect({ ...base, preview: true, cookieHeader: "cos_preview_login=manual" }))
      .toBe(`https://auth-x.preview.contentos.ch/sign-in?redirect=${encodeURIComponent(base.back)}`)
  })
})
```

- [ ] **Step 2: Run, vérifier l'échec**

Run: `cd projects/ressources && npx vitest run lib/auth/preview.test.ts`
Expected: FAIL (`hasManualMarker`/`loginRedirect` non exportés).

- [ ] **Step 3: Étendre `preview.ts`**

Ajouter à `projects/ressources/lib/auth/preview.ts` (garder l'existant `isPreviewEnv`/`isPreview`) :

```ts
// Identités de preview (convention partagée avec auth + autres clients).
export const PREVIEW_OP_1_ID = "preview-op-1"
export const PREVIEW_OP_2_ID = "preview-op-2"
export const PREVIEW_AUD_3_ID = "preview-aud-3"
// Utilisateur auto-connecté par défaut sur cette app (1 = op1 ; docs surcharge à 3).
export const DEFAULT_PREVIEW_USER: 1 | 2 | 3 = 1

const MARKER = "cos_preview_login"
export function hasManualMarker(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && new RegExp(`(?:^|;\\s*)${MARKER}=manual`).test(cookieHeader)
}

// URL de redirection pour un visiteur sans session. Pur (pas d'env) → testable.
export function loginRedirect(opts: {
  authUrl: string
  back: string
  preview: boolean
  cookieHeader: string | null | undefined
  defaultUser?: 1 | 2 | 3
}): string {
  const r = encodeURIComponent(opts.back)
  if (opts.preview && !hasManualMarker(opts.cookieHeader)) {
    return `${opts.authUrl}/preview-login?user=${opts.defaultUser ?? DEFAULT_PREVIEW_USER}&redirect=${r}`
  }
  return `${opts.authUrl}/sign-in?redirect=${r}`
}
```

Note `PREVIEW_USER_ID`/`PREVIEW_USER_EMAIL` existants : conserver pour l'instant (utilisés ailleurs), retirés en Task 6.

- [ ] **Step 4: Run, vérifier le succès**

Run: `cd projects/ressources && npx vitest run lib/auth/preview.test.ts`
Expected: PASS.

- [ ] **Step 5: Répliquer dans docs / media / cast**

Copier le même bloc (constantes + `hasManualMarker` + `loginRedirect`) dans :
- `projects/docs/lib/auth/preview.ts` — mais **`DEFAULT_PREVIEW_USER: 1 | 2 | 3 = 3`**.
- `projects/media/src/lib/auth/preview.ts` — `DEFAULT_PREVIEW_USER = 1`.
- `projects/cast/src/lib/auth/preview.ts` — `DEFAULT_PREVIEW_USER = 1`.

(Copier aussi le test dans docs avec `defaultUser: 3` attendu, ou laisser le test ressources couvrir la logique pure.)

- [ ] **Step 6: Commit**

```bash
git add projects/ressources/lib/auth/preview.ts projects/ressources/lib/auth/preview.test.ts \
  projects/docs/lib/auth/preview.ts projects/media/src/lib/auth/preview.ts projects/cast/src/lib/auth/preview.ts
git commit -m "clients: helper loginRedirect (auto-login vs chooser) + identités preview"
```

---

## Task 6 : clients — supprimer le court-circuit dans session.ts

Pour **chaque** client, retirer le `if (isPreview) return <preview-user>` de `fetchSession`,
et router la redirection « pas de session » via `loginRedirect`. Ajouter `signOutUrl()`.

### 6a — ressources (`projects/ressources/lib/auth/session.ts`)

- [ ] **Step 1: Modifier fetchSession + requireSession + signInUrl + ajouter signOutUrl**

Remplacer le bloc `if (isPreview) {...}` de `fetchSession` par : (rien — supprimer le court-circuit, garder la vraie `get-session`).

Modifier l'import :
```ts
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "./preview"
```

Remplacer `signInRedirectUrl` et `requireSession` :
```ts
function signInRedirectUrl(target?: string, cookieHeader?: string | null): string {
  return loginRedirect({
    authUrl: env.AUTH_URL,
    back: target ?? env.APP_URL,
    preview: isPreview,
    cookieHeader: cookieHeader ?? null,
    defaultUser: DEFAULT_PREVIEW_USER,
  })
}

export async function requireSession(target?: string): Promise<Session> {
  const h = await headers()
  const s = await fetchSession(h)
  if (!s) redirect(signInRedirectUrl(target, h.get("cookie")))
  return s
}
```

`getSession`/`getUserId`/`requireUserId` restent (requireUserId appelle requireSession).

`signInUrl(target?)` (lien « se connecter ») : conserver, mais sans cookieHeader il
mènera à preview-login en preview — acceptable (c'est un lien de connexion). Le laisser tel quel via `loginRedirect` sans cookieHeader.

Ajouter le helper de déconnexion :
```ts
// URL de déconnexion. En preview → preview-logout (efface + pose le marqueur).
export function signOutUrl(): string {
  if (isPreview) return `${env.AUTH_URL}/preview-logout?redirect=${encodeURIComponent(env.APP_URL)}`
  return `${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`
}
```

- [ ] **Step 2: Câbler signOutAction**

`projects/ressources/lib/actions/account.ts` :
```ts
"use server"
import { redirect } from "next/navigation"
import { signOutUrl } from "@/lib/auth/session"

export async function signOutAction() {
  redirect(signOutUrl())
}
```

### 6b — docs (`projects/docs/lib/auth/session.ts`)

- [ ] **Step 3: Même transformation que 6a**, mais persona audience : `fetchSession` ne court-circuite plus ; redirection via `loginRedirect` avec `DEFAULT_PREVIEW_USER` (=3 dans docs/preview.ts). Ajouter `signOutUrl()`. Câbler `projects/docs/lib/actions/account.ts` `signOutAction` vers `signOutUrl()`.

### 6c — media (`projects/media/src/lib/session.ts`)

- [ ] **Step 4: Transformer**

Supprimer `if (isPreview) return { user: { id: PREVIEW_USER_ID } }`. Import :
```ts
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview";
```
`requireUserId` :
```ts
export async function requireUserId(): Promise<string> {
  const h = await headers();
  const s = await fetchSession(h);
  if (!s) redirect(loginRedirect({ authUrl: env.AUTH_URL, back: env.APP_URL, preview: isPreview, cookieHeader: h.get("cookie"), defaultUser: DEFAULT_PREVIEW_USER }));
  return s.user.id;
}
```
`getUserId` : inchangé (retourne undefined si pas de session).
Ajouter `signOutUrl()` (même forme que 6a) et exporter.

Câbler `projects/media/src/app/(admin)/admin-nav.tsx` : remplacer la valeur passée à `<SignOutButton authUrl=… />` par l'URL de logout. Lire la valeur via `signOutUrl()` côté serveur et passer `signOutHref` au bouton ; adapter `sign-out-button.tsx` pour prendre `href`.

Aussi `projects/media/src/app/sign-in/page.tsx` : retirer `if (isPreview) redirect("/gallery")` → en preview on doit pouvoir atteindre le vrai SSO. Remplacer par redirect inconditionnel vers `loginRedirect({...})` (ou simplement `${AUTH_URL}/sign-in?...`). Détail : page sign-in de media sert juste de tremplin ; rediriger vers `signInUrl`-équivalent.

### 6d — cast (`projects/cast/src/lib/auth/session.ts`)

- [ ] **Step 5: Transformer**

Supprimer `if (isPreview) return { user: { id: PREVIEW_USER_ID } }`. Conserver `ensureSeeded`/`seedUserDefaults` (seede les défauts pour qui se connecte). Import + `requireUserId`/`getUserId` redirigent via `loginRedirect`. Ajouter `signOutUrl()`.
Câbler `projects/cast/src/components/layout/app-header.tsx` : l'`<a href={authUrl}>` de déconnexion → `href={signOutUrl()}` (calculé côté serveur et passé en prop, comme `authUrl` l'est déjà).
`projects/cast/src/app/(auth)/signin/page.tsx` : retirer la branche `if (isPreview) redirect('/api/preview-login?redirect=/')` → rediriger via `loginRedirect`. `projects/cast/src/app/api/preview-login/route.ts` (ancien) devient inutile : le supprimer.

- [ ] **Step 6: Tests + build par projet**

Run (chacun) :
- `cd projects/ressources && npm test`
- `cd projects/docs && npm test`
- `cd projects/media && npm test`
- `cd projects/cast && npm test`
Expected: suites vertes (corriger les tests qui s'appuyaient sur le court-circuit preview, le cas échéant).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "clients: vraie get-session en preview + auto-login/chooser + signOutUrl"
```

---

## Task 7 : clients — middleware gate en preview

Pour **media, cast** (matcher large) et **ressources, docs** (zones gardées) :
retirer `if (isPreview) return NextResponse.next()` et router la redirection via `loginRedirect`.

- [ ] **Step 1: media middleware** (`projects/media/src/middleware.ts`)

Remplacer `if (isPreview) return NextResponse.next();` (le supprimer) et le `dest` :
```ts
import { isPreview, loginRedirect, DEFAULT_PREVIEW_USER } from "@/lib/auth/preview";
// ...
  const cookie = request.headers.get("cookie") ?? "";
  const hasSession = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
  if (!hasSession) {
    const url = new URL(request.url);
    const back = `${env.APP_URL}${url.pathname}${url.search}`;
    const dest = loginRedirect({ authUrl: env.AUTH_URL, back, preview: isPreview, cookieHeader: cookie, defaultUser: DEFAULT_PREVIEW_USER });
    return NextResponse.redirect(dest);
  }
  return NextResponse.next();
```
(Le matcher exclut déjà `sign-in`; vérifier qu'il exclut aussi les assets — OK.)

- [ ] **Step 2: cast middleware** (`projects/cast/src/middleware.ts`) — même transformation. Le matcher exclut déjà `signin`, `api/auth`, `api/preview-login` (à laisser ou nettoyer).

- [ ] **Step 3: ressources middleware** (`projects/ressources/middleware.ts`) — retirer le court-circuit preview ; dans le bloc `SSO_GATED`, remplacer le `dest` par `loginRedirect({...})`.

- [ ] **Step 4: docs middleware** (`projects/docs/middleware.ts`) — idem ; `DEFAULT_PREVIEW_USER` = 3 (depuis docs/preview.ts).

- [ ] **Step 5: Builds**

Run (chacun) : `npm run build` dans les 4 projets.
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "clients: middleware gate SSO actif en preview (auto-login/chooser)"
```

---

## Task 8 : MCP — userId par défaut = op1 en preview

**Files:**
- Modify: `projects/media/src/lib/mcp/auth.ts`, `projects/cast/src/lib/mcp/auth.ts`, `projects/ressources/lib/mcp-auth.ts`

- [ ] **Step 1:** Remplacer la référence `PREVIEW_USER_ID` par `PREVIEW_OP_1_ID` (= `"preview-op-1"`) là où l'userId est figé en preview. Importer `PREVIEW_OP_1_ID` depuis le `preview.ts` du projet (media/cast utilisent `@/lib/auth/preview`).

- [ ] **Step 2: Builds + tests** des 3 projets.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "clients: MCP preview utilise op1 par défaut"
```

---

## Task 9 : ressources — seed deux opérateurs + abonné

**Files:**
- Modify: `projects/ressources/db/seed.ts`

- [ ] **Step 1: Garde anti-prod en tête de `seed()`**

```ts
if (process.env.APP_ENV === "prod") {
  console.log("seed: APP_ENV=prod → pas de données de démo (refusé).")
  process.exit(0)
}
```

- [ ] **Step 2: Paramétrer par opérateur**

- Importer les ids : `import { PREVIEW_OP_1_ID, PREVIEW_OP_2_ID, PREVIEW_AUD_3_ID } from "../lib/auth/preview"` et les tables `audienceMembers, subscriptions` (depuis `./schema`).
- `createResource` et `addPage` prennent `operatorId` en 1er argument (pour `createResource`, l'ajouter aux `meta`).
- Définir `async function seedOperator(operatorId: string, handle: string, name: string, full: boolean)` qui :
  - upsert l'opérateur (`operators`), puis `delete` ses ressources par slug, puis crée les ressources.
  - `full=true` (op1) : tout le contenu actuel (showcase, guide-ia, automatiser-n8n, deployer-coolify, manifeste, atelier-prive).
  - `full=false` (op2) : un sous-ensemble distinct (slugs/titres différents, ex. `showcase`, `guide-ia` allégés + une privée `atelier-prive`) pour rendre l'isolation visible (op2 a SES ressources, pas celles d'op1).
  - retourner les ressources créées (pour brancher l'abonné).
- Appeler `seedOperator(PREVIEW_OP_1_ID, "user1", "User 1", true)` et `seedOperator(PREVIEW_OP_2_ID, "user2", "User 2", false)`.

- [ ] **Step 3: Abonné user3**

Après les deux opérateurs :
```ts
// user3 (audience) abonné aux deux opérateurs.
for (const opId of [PREVIEW_OP_1_ID, PREVIEW_OP_2_ID]) {
  await db.insert(audienceMembers)
    .values({ operatorId: opId, userId: PREVIEW_AUD_3_ID })
    .onConflictDoNothing()
}
// Abonnement à quelques ressources publiques (récupérées de seedOperator).
for (const r of subscribableResources) {
  await db.insert(subscriptions)
    .values({ userId: PREVIEW_AUD_3_ID, resourceId: r.id })
    .onConflictDoNothing()
}
// Accès par email à une ressource privée d'op1.
await db.insert(resourceAccess)
  .values({ resourceId: privateOp1Resource.id, email: "user3@avqn.ch" })
  .onConflictDoNothing()
```
(`subscribableResources` / `privateOp1Resource` = renvoyés par `seedOperator`. Conserver aussi l'accès `client@exemple.com` existant si voulu.)

- [ ] **Step 4: Vérifier la garde anti-prod**

Run: `cd projects/ressources && APP_ENV=prod node --import tsx db/seed.ts`
Expected: « APP_ENV=prod → pas de données de démo (refusé). », exit 0, aucune écriture.

- [ ] **Step 5: Lancer le seed sur une base de dev** (si dispo via `scripts/dev-db.sh up ressources`) et vérifier que les deux espaces `/o/user1` `/o/user2` ont leur contenu et que user3 a des abonnements. Sinon, vérification reportée à la preview déployée.

- [ ] **Step 6: Commit**

```bash
git add projects/ressources/db/seed.ts
git commit -m "ressources: seed 2 opérateurs + abonné user3 (preview only)"
```

---

## Task 10 : media — seed deux opérateurs

**Files:**
- Modify: `projects/media/scripts/seed.mjs`

- [ ] **Step 1: Garde anti-prod en tête**

```js
if (process.env.APP_ENV === "prod") {
  console.log("seed: APP_ENV=prod → pas de données de démo (refusé).");
  process.exit(0);
}
```

- [ ] **Step 2: Boucler sur les deux opérateurs**

Remplacer `const USER_ID = "preview-user";` par une boucle sur `["preview-op-1", "preview-op-2"]`. Extraire les inserts (brand/styles/guide/template) dans une fonction `seedForUser(sql, userId)` ; **préfixer les ids de seed par user** pour éviter les collisions de PK (`seed-style-3d-${userId}`, etc.). Appeler pour les deux. Conserver `ON CONFLICT DO NOTHING`.

- [ ] **Step 3: Garde anti-prod**

Run: `cd projects/media && APP_ENV=prod node scripts/seed.mjs`
Expected: refus, exit 0.

- [ ] **Step 4: Commit**

```bash
git add projects/media/scripts/seed.mjs
git commit -m "media: seed pour les 2 opérateurs (preview only)"
```

---

## Task 11 : cast — ajouter un seed preview

**Files:**
- Create: `projects/cast/scripts/seed-preview.ts`
- Modify: `projects/cast/lab.json`

- [ ] **Step 1: Script de seed**

```ts
// projects/cast/scripts/seed-preview.ts
#!/usr/bin/env tsx
import { seedDev } from "@/lib/db/seeds/dev-sample";

const USERS = ["preview-op-1", "preview-op-2"];

async function main(): Promise<void> {
  if (process.env.APP_ENV === "prod") {
    console.log("seed: APP_ENV=prod → pas de données de démo (refusé).");
    process.exit(0);
  }
  for (const userId of USERS) {
    await seedDev(userId);
    console.log(`seed: contenu d'exemple assuré pour ${userId}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Vérifier la signature de `seedDev` dans `projects/cast/src/lib/db/seeds/dev-sample.ts` et l'idempotence ; adapter si nécessaire.

- [ ] **Step 2: Déclarer le seed dans lab.json**

Ajouter la clé `"seed": "tsx scripts/seed-preview.ts"` à `projects/cast/lab.json`. Vérifier que `tsx` est exécutable dans l'image `web` (sinon `node --import tsx scripts/seed-preview.ts`).

- [ ] **Step 3: Garde anti-prod**

Run: `cd projects/cast && APP_ENV=prod tsx scripts/seed-preview.ts`
Expected: refus, exit 0.

- [ ] **Step 4: Commit**

```bash
git add projects/cast/scripts/seed-preview.ts projects/cast/lab.json
git commit -m "cast: seed preview pour les 2 opérateurs (preview only)"
```

---

## Task 12 : deploy.sh — injecter AUTH_URL par branche en preview

**Files:**
- Modify: `scripts/deploy.sh`

- [ ] **Step 1: Injecter AUTH_URL après APP_URL**

Après la ligne `printf 'APP_URL=https://%s\n' "$PRIMARY_HOST" >> "$APPDIR/.env"` (ligne ~150), ajouter :

```bash
# En preview, les clients parlent à l'auth de LEUR branche (auth-<branche>.preview…).
# En prod, on laisse le défaut applicatif (https://auth.contentos.ch).
if [ "$ENV" != "prod" ]; then
  printf 'AUTH_URL=https://auth-%s.preview.contentos.ch\n' "$ENV" >> "$APPDIR/.env"
fi
```

- [ ] **Step 2: Vérif syntaxe**

Run: `bash -n scripts/deploy.sh`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "deploy: injecte AUTH_URL par branche en preview"
```

---

## Task 13 : docs — note CLAUDE.md sur la convention + nettoyage

**Files:**
- Modify: `projects/auth/CLAUDE.md` (et éventuellement les CLAUDE.md clients)

- [ ] **Step 1:** Documenter la convention d'identités preview (3 users, emails, accountType), les routes `preview-login`/`preview-logout`, le marqueur, et l'injection `AUTH_URL` par branche. Mentionner que `src/lib/preview-users.ts` (auth) et les seeds clients doivent rester en phase.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: documente le flux d'auth/seed de preview"
```

---

## Task 14 : Vérification finale + sync shared

- [ ] **Step 1: Sync du noyau partagé** (ressources → docs, au cas où schema touché)

Run: `bash scripts/sync-shared.sh && git diff --stat`
Expected: pas de diff non commité (sinon committer la resync).

- [ ] **Step 2: Tests de tous les projets touchés**

Run: `npm test` dans ressources, docs, media, cast, auth (selon dispo des bases de test).
Expected: vert.

- [ ] **Step 3: Builds de tous les projets touchés**

Run: `npm run build` dans auth, ressources, docs, media, cast.
Expected: OK.

- [ ] **Step 4: Commit éventuel + push de la branche**

```bash
git push -u origin claude/pensive-goldberg-buwjW
```

---

## Self-review (couverture du spec)

- Identités partagées → Task 1, 2, 5, 9, 10, 11. ✓
- auth seed preview-only → Task 2 (garde anti-prod). ✓
- preview-login / preview-logout / marqueur → Task 3. ✓
- chooser user1/2/3 → Task 4. ✓
- suppression court-circuit + redirect auto/chooser (session + middleware) → Task 6, 7. ✓
- signOutUrl → preview-logout → Task 6. ✓
- MCP op1 par défaut → Task 8. ✓
- seeds 2 opérateurs + abonné (ressources/media/cast ; docs via partagé) → Task 9, 10, 11. ✓
- deploy.sh AUTH_URL par branche → Task 12. ✓
- tests TDD (helper pur, gardes anti-prod) → Task 5, 9, 10, 11. ✓
- local inchangé (court-circuit ne couvrait que preview) → vrai par construction. ✓
