# Contentos — login OTP : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans pour exécuter tâche par tâche. Les steps utilisent des cases à cocher (`- [ ]`).

**Goal:** Remplacer le login magic-link de Contentos par un code OTP par email (flux Ressources, look shadcn), avec auto-login en preview.

**Architecture:** Plugin better-auth `magicLink` → `emailOTP`. `/signin` devient une porte server-side qui, en preview, redirige vers une route d'auto-login pilotant le moteur emailOTP avec un code fixe ; sinon rend un formulaire client deux-étapes. Détection preview via `APP_ENV` (injecté par `deploy.sh`).

**Tech Stack:** Next.js 16 (App Router), better-auth 1.6.11 (`emailOTP`, `mcp`), Drizzle/Postgres, Resend, Vitest + Playwright.

Commandes de vérification (worktree `contentos/`) :
- types : `npx tsc --noEmit`
- lint : `npm run lint`
- unit : `npm run test:unit`
- e2e : `npm run test:e2e` (nécessite build + DB de test ; lancé en vérif finale)

---

### Task 1 : détection preview + constantes (fonction pure, TDD)

**Files:**
- Modify: `src/lib/env.ts`
- Create: `src/lib/auth/preview.ts`
- Test: `test/unit/preview-env.test.ts`

- [ ] **Step 1 : test qui échoue**

```ts
// test/unit/preview-env.test.ts
import { describe, expect, test } from 'vitest';
import { isPreviewEnv } from '@/lib/auth/preview';

describe('isPreviewEnv', () => {
  test('faux quand APP_ENV est absent (local)', () => {
    expect(isPreviewEnv(undefined)).toBe(false);
  });
  test('faux quand APP_ENV vaut prod', () => {
    expect(isPreviewEnv('prod')).toBe(false);
  });
  test('faux quand APP_ENV est vide', () => {
    expect(isPreviewEnv('')).toBe(false);
  });
  test('vrai pour un slug de branche (preview déployée)', () => {
    expect(isPreviewEnv('work-contentos-otp')).toBe(true);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `npm run test:unit -- preview-env`
Expected: FAIL (`@/lib/auth/preview` introuvable).

- [ ] **Step 3 : ajouter `APP_ENV` au schéma env**

Dans `src/lib/env.ts`, ajouter dans `envSchema` (après `E2E_TESTING`) :

```ts
  APP_ENV: z.string().optional(),
```

- [ ] **Step 4 : créer le module preview**

```ts
// src/lib/auth/preview.ts
import { env } from '@/lib/env';

// Identité de test utilisée pour l'auto-login en preview.
export const PREVIEW_USER = 'preview@contentos.local';
// Code OTP déterministe accepté en preview (jamais en prod).
export const PREVIEW_OTP = '000000';

// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
// En prod APP_ENV vaut 'prod' ; en local il est absent. APP_ENV est le seul
// discriminant fiable : NODE_ENV vaut 'production' en preview comme en prod.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== 'prod';
}

export const isPreview = isPreviewEnv(env.APP_ENV);
```

- [ ] **Step 5 : vérifier le succès**

Run: `npm run test:unit -- preview-env`
Expected: PASS (4 tests).

- [ ] **Step 6 : commit**

```bash
git add src/lib/env.ts src/lib/auth/preview.ts test/unit/preview-env.test.ts
git commit -m "🤖 contentos: détection env preview (APP_ENV) + constantes auto-login"
```

---

### Task 2 : moteur d'auth — plugin emailOTP + email du code

**Files:**
- Modify: `src/lib/auth/server.ts`

- [ ] **Step 1 : remplacer le plugin magicLink par emailOTP**

Remplacer l'import ligne 3 :

```ts
import { emailOTP, mcp } from 'better-auth/plugins';
```

Ajouter l'import preview en tête (après `env`) :

```ts
import { PREVIEW_OTP, isPreview } from '@/lib/auth/preview';
```

Remplacer le bloc `magicLink({ ... })` (lignes 15-24) par :

```ts
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      // En preview : code déterministe + aucun email (permet l'auto-login).
      generateOTP: isPreview ? () => PREVIEW_OTP : undefined,
      sendVerificationOTP: async ({ email, otp }) => {
        if (isPreview) return;
        await sendEmail({
          to: email,
          subject: 'Ton code de connexion à content-os',
          html: otpEmailHtml(otp),
        });
      },
    }),
```

- [ ] **Step 2 : ajouter le template d'email** (en bas du fichier, après l'export `auth`)

```ts
function otpEmailHtml(code: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;font-weight:700">Ton code de connexion</h1>
  <p>Saisis ce code pour te connecter à content-os :</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:16px 0">${code}</p>
  <p style="color:#666">Ce code expire dans 10 minutes.</p>
</div>`;
}
```

- [ ] **Step 3 : vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur sur `src/lib/auth/server.ts`.

- [ ] **Step 4 : commit**

```bash
git add src/lib/auth/server.ts
git commit -m "🤖 contentos: auth emailOTP (code 6 chiffres) + code fixe en preview"
```

---

### Task 3 : client d'auth — emailOTPClient

**Files:**
- Modify: `src/lib/auth/client.ts`

- [ ] **Step 1 : remplacer le plugin client**

```ts
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 2 : vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : commit**

```bash
git add src/lib/auth/client.ts
git commit -m "🤖 contentos: client auth emailOTPClient"
```

---

### Task 4 : écran /signin — porte server + formulaire OTP, suppression de /verify

**Files:**
- Modify: `src/app/(auth)/signin/page.tsx` (devient server component)
- Create: `src/app/(auth)/signin/otp-form.tsx` (client)
- Delete: `src/app/(auth)/verify/page.tsx` (+ dossier `verify/`)

- [ ] **Step 1 : créer le formulaire client deux-étapes**

```tsx
// src/app/(auth)/signin/otp-form.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth/client';

export function OtpForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setLoading(false);
    if (error) setError('Envoi impossible. Réessaie.');
    else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    setLoading(false);
    if (error) {
      setError('Code invalide ou expiré.');
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.com"
            disabled={loading}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !email} className="w-full">
          {loading ? 'Envoi...' : 'Recevoir mon code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-neutral-600">
        Code envoyé à <span className="font-medium text-neutral-900">{email}</span>.
      </p>
      <div className="space-y-2">
        <Label htmlFor="code">Code à 6 chiffres</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="000000"
          disabled={loading}
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || code.length < 6} className="w-full">
        {loading ? 'Vérification...' : 'Se connecter'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setStep('email');
          setError(null);
          setCode('');
        }}
      >
        Changer d'email
      </Button>
    </form>
  );
}
```

- [ ] **Step 2 : transformer page.tsx en porte server component**

```tsx
// src/app/(auth)/signin/page.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { isPreview } from '@/lib/auth/preview';
import { OtpForm } from './otp-form';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; redirectTo?: string }>;
}) {
  const sp = await searchParams;
  const target = sp.redirect || sp.redirectTo || '/';

  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(target);
  if (isPreview) redirect(`/api/preview-login?redirect=${encodeURIComponent(target)}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>Reçois un code par email pour te connecter.</CardDescription>
      </CardHeader>
      <CardContent>
        <OtpForm redirectTo={target} />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3 : supprimer la page /verify**

```bash
git rm src/app/(auth)/verify/page.tsx
```

- [ ] **Step 4 : vérifier types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: aucune erreur (plus aucune référence à `/verify` ni `magicLink`).

- [ ] **Step 5 : commit**

```bash
git add "src/app/(auth)/signin/page.tsx" "src/app/(auth)/signin/otp-form.tsx"
git commit -m "🤖 contentos: écran /signin OTP deux-étapes (shadcn), suppression de /verify"
```

---

### Task 5 : route d'auto-login preview

**Files:**
- Create: `src/app/api/preview-login/route.ts`

- [ ] **Step 1 : créer la route**

```ts
// src/app/api/preview-login/route.ts
// Auto-login des environnements de preview : connecte un utilisateur de test
// fixe sans email ni saisie. Inerte hors preview (garde isPreview).
import { auth } from '@/lib/auth/server';
import { PREVIEW_OTP, PREVIEW_USER, isPreview } from '@/lib/auth/preview';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = url.searchParams.get('redirect') || '/';

  if (!isPreview) {
    return Response.redirect(new URL('/signin', url.origin), 302);
  }

  // 1. Génère/stocke le code fixe (sendVerificationOTP ne fait rien en preview).
  await auth.api.sendVerificationOTP({
    body: { email: PREVIEW_USER, type: 'sign-in' },
  });

  // 2. Vérifie avec le code fixe → crée user (+ seedUserDefaults) et session.
  const signInRes = await auth.api.signInEmailOTP({
    body: { email: PREVIEW_USER, otp: PREVIEW_OTP },
    asResponse: true,
  });

  // 3. Recopie les cookies de session sur une redirection vers la cible.
  const res = new Response(null, {
    status: 302,
    headers: { Location: new URL(target, url.origin).toString() },
  });
  for (const cookie of signInRes.headers.getSetCookie()) {
    res.headers.append('Set-Cookie', cookie);
  }
  return res;
}
```

- [ ] **Step 2 : vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : commit**

```bash
git add src/app/api/preview-login/route.ts
git commit -m "🤖 contentos: route auto-login preview (inerte hors preview)"
```

---

### Task 6 : E2E — flux OTP réel

**Files:**
- Modify: `test/e2e/auth.spec.ts`

- [ ] **Step 1 : réécrire le test pour le flux OTP**

```ts
// test/e2e/auth.spec.ts
import { expect, type Page, test } from '@playwright/test';

const TEST_EMAIL = `playwright-${Date.now()}@test.invalid`;

async function fetchOtp(page: Page, email: string): Promise<string> {
  // Poll l'inbox in-memory jusqu'à trouver le code à 6 chiffres dans l'email.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/(\d{6})/);
      if (!match) throw new Error('OTP code not found in email html');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('OTP email never arrived');
}

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/__test__/emails');
  });

  test('signin → code OTP → dashboard → logout', async ({ page }) => {
    // 1. La racine redirige vers /signin
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);

    // 2. Saisir l'email et demander le code
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');

    // 3. L'étape code apparaît
    await expect(page.locator('#code')).toBeVisible();

    // 4. Récupérer le code depuis l'inbox de test et le saisir
    const otp = await fetchOtp(page, TEST_EMAIL);
    await page.fill('#code', otp);
    await page.click('button[type="submit"]');

    // 5. Arrive sur le dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Bienvenue/)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL).first()).toBeVisible();

    // 6. Logout
    await page.click('button:has-text("Se déconnecter")');
    await expect(page).toHaveURL(/\/signin$/);

    // 7. Accès à / sans session → redirect
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
  });
});
```

- [ ] **Step 2 : commit**

```bash
git add test/e2e/auth.spec.ts
git commit -m "🤖 contentos: E2E flux OTP (remplace magic link)"
```

---

### Task 7 : vérification finale

- [ ] **Step 1 : types + lint + unit**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: tout passe. Aucune occurrence résiduelle de `magicLink`/`/verify` (`grep -rn "magicLink\|/verify" src test`).

- [ ] **Step 2 : build Next** (vérifie la compilation des routes/server components)

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 3 : E2E** (si DB de test dispo localement)

Run: `npm run db:test:prepare && npm run test:e2e`
Expected: le test « signin → code OTP → dashboard → logout » passe. Si l'environnement local ne permet pas l'E2E, s'appuyer sur la CI / la preview pour la validation manuelle.

---

## Couverture de la spec

- §1 moteur emailOTP + generateOTP/sendVerificationOTP preview → Task 2
- §2 client emailOTPClient → Task 3
- §3 /signin porte + otp-form, suppression /verify → Task 4
- §4 route auto-login preview → Task 5
- §5 APP_ENV + isPreview → Task 1
- §6 email du code → Task 2
- §7 tests (E2E OTP + unit isPreviewEnv) → Task 1 + Task 6

Note : `EmailMessage` n'a pas de champ `text` ; l'email est envoyé en `html` seul (la variante texte de la spec est omise volontairement pour ne pas modifier le type partagé).
