# Spec 8 (Connexion LinkedIn) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connecter un compte LinkedIn via OAuth, stocker le token chiffré (AES-256-GCM) + l'URN membre, et l'afficher dans `/settings/connections` (nom, jours avant expiration, reconnecter/déconnecter).

**Architecture:** Table `social_accounts` (Drizzle, scopée user). Util `crypto.ts` (AES-256-GCM, clé dérivée SHA-256 de `TOKEN_ENCRYPTION_KEY`). Client OAuth injectable (`exchangeCode` réel/stub). Routes `/api/linkedin/connect` (state cookie → redirect) + `/api/linkedin/callback` (échange → chiffre → upsert). `CONTENT_OS_LINKEDIN_STUB=1` court-circuite LinkedIn pour CI/E2E.

**Tech Stack:** Drizzle/Postgres, Next.js 16 App Router (route handlers + `cookies()` + Server Actions), `node:crypto` (fetch natif), Vitest, Playwright. Aucune nouvelle dépendance.

**Référence spec :** `docs/superpowers/specs/2026-05-24-spec-8-linkedin-connection-design.md`

---

## File Structure

**Nouveaux :**
- `src/lib/crypto.ts` — `encryptToken` / `decryptToken`.
- `src/lib/linkedin/oauth.ts` — `getAuthorizeUrl`, `ExchangeFn`, `exchangeCodeReal`, `exchangeCodeStub`, `exchangeCode`.
- `src/lib/linkedin/runway.ts` — `runwayDays`.
- `src/lib/linkedin/connect-core.ts` — `connectFromCode` (échange + chiffre + upsert).
- `src/lib/db/schemas/social-accounts.ts` — table.
- `src/lib/db/repositories/social-accounts.ts` — CRUD.
- `src/app/api/linkedin/connect/route.ts`, `src/app/api/linkedin/callback/route.ts`.
- `src/app/(app)/settings/connections/page.tsx`, `actions.ts`, `_components/disconnect-button.tsx`.
- Tests : `test/unit/crypto.test.ts`, `test/unit/linkedin-oauth.test.ts`, `test/unit/linkedin-runway.test.ts`, `test/integration/social-accounts-repository.test.ts`, `test/integration/linkedin-connect-core.test.ts`, `test/e2e/linkedin-connection.spec.ts`.

**Modifiés :**
- `src/lib/env.ts` (+4 vars), `.env.example`.
- `src/lib/db/schema.ts` (barrel).
- `src/components/settings/settings-sidebar.tsx` (lien Connexions).
- `playwright.config.ts` (webServer.env `CONTENT_OS_LINKEDIN_STUB`).

---

## Task 1: env + crypto

**Files:** Modify `src/lib/env.ts`, `.env.example`. Create `src/lib/crypto.ts`, `test/unit/crypto.test.ts`.

- [ ] **Step 1: env vars**

`src/lib/env.ts` — ajouter dans `envSchema` (avant `E2E_TESTING`) :

```ts
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
```

`.env.example` — ajouter :

```
# LinkedIn (publication). Crée une app LinkedIn avec le produit "Share on LinkedIn"
# (scope w_member_social) et enregistre le redirect ${APP_URL}/api/linkedin/callback.
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# Clé de chiffrement des tokens (n'importe quelle chaîne ; dérivée en clé AES-256 via SHA-256).
TOKEN_ENCRYPTION_KEY=
# Stub LinkedIn : si "1", connecte un compte factice sans appeler LinkedIn (CI/E2E).
CONTENT_OS_LINKEDIN_STUB=0
```

- [ ] **Step 2: Write crypto test (TDD)**

`test/unit/crypto.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { decryptToken, encryptToken } from '@/lib/crypto';

describe('token crypto', () => {
  test('round-trip', () => {
    const blob = encryptToken('mon-access-token');
    expect(blob).not.toContain('mon-access-token');
    expect(decryptToken(blob)).toBe('mon-access-token');
  });

  test('deux chiffrements diffèrent (iv aléatoire)', () => {
    expect(encryptToken('x')).not.toBe(encryptToken('x'));
  });

  test('blob altéré échoue (authTag GCM)', () => {
    const blob = encryptToken('secret');
    const raw = Buffer.from(blob, 'base64');
    raw[raw.length - 1] ^= 0xff; // flip dernier octet
    expect(() => decryptToken(raw.toString('base64'))).toThrow();
  });
});
```

- [ ] **Step 3: Run (FAIL)** — `npm run test:unit -- crypto`

- [ ] **Step 4: Implement `src/lib/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

function key(): Buffer {
  return createHash('sha256').update(env.TOKEN_ENCRYPTION_KEY ?? '').digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(blob: string): string {
  const raw = Buffer.from(blob, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 5: Run (PASS)** — `npm run test:unit -- crypto`

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts .env.example src/lib/crypto.ts test/unit/crypto.test.ts
git commit -m "🤖 feat(spec-8): env LinkedIn + crypto AES-256-GCM tokens"
```

---

## Task 2: table social_accounts + repository

**Files:** Create `src/lib/db/schemas/social-accounts.ts`, `src/lib/db/repositories/social-accounts.ts`, `test/integration/social-accounts-repository.test.ts`. Modify `src/lib/db/schema.ts`. Migration.

- [ ] **Step 1: Schema**

`src/lib/db/schemas/social-accounts.ts` :

```ts
import { index, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    externalId: text('external_id').notNull(),
    displayName: text('display_name').notNull(),
    accessToken: text('access_token').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    scopes: text('scopes').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('social_accounts_user_id_idx').on(table.userId),
    unique('social_accounts_user_id_platform_unique').on(table.userId, table.platform),
  ],
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
```

- [ ] **Step 2: Barrel** — `src/lib/db/schema.ts` : ajouter `export * from './schemas/social-accounts';` (ordre alpha : après `settings`).

- [ ] **Step 3: Migration**

```bash
npm run db:generate && npm run db:migrate
```

Expected : table `social_accounts` créée.

- [ ] **Step 4: Setup-integration truncate** — `test/setup-integration.ts` : importer `socialAccounts` et ajouter `await db.delete(socialAccounts);` (avant `user`, après les autres tables référençant user).

- [ ] **Step 5: Write repository test (TDD)**

`test/integration/social-accounts-repository.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import {
  deleteSocialAccount,
  getSocialAccount,
  upsertSocialAccount,
} from '@/lib/db/repositories/social-accounts';
import { createTestUser } from './helpers/seed';

const DATA = {
  platform: 'linkedin',
  externalId: 'urn:li:person:abc',
  displayName: 'Jean',
  accessToken: 'cipher',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: 'openid w_member_social',
};

describe('social-accounts repository', () => {
  test('upsert insère puis met à jour (reconnexion)', async () => {
    const u = await createTestUser('sa-up');
    const a = await upsertSocialAccount(u, DATA);
    expect(a.displayName).toBe('Jean');
    const b = await upsertSocialAccount(u, { ...DATA, displayName: 'Jean 2', accessToken: 'cipher2' });
    expect(b.id).toBe(a.id); // même row (conflit user+platform)
    expect(b.displayName).toBe('Jean 2');
    expect(b.accessToken).toBe('cipher2');
  });

  test('get scopé user', async () => {
    const a = await createTestUser('sa-a');
    const b = await createTestUser('sa-b');
    await upsertSocialAccount(a, DATA);
    expect(await getSocialAccount(a, 'linkedin')).toBeDefined();
    expect(await getSocialAccount(b, 'linkedin')).toBeUndefined();
  });

  test('delete scopé user', async () => {
    const a = await createTestUser('sa-del-a');
    const b = await createTestUser('sa-del-b');
    await upsertSocialAccount(a, DATA);
    await deleteSocialAccount(b, 'linkedin'); // no-op cross-tenant
    expect(await getSocialAccount(a, 'linkedin')).toBeDefined();
    await deleteSocialAccount(a, 'linkedin');
    expect(await getSocialAccount(a, 'linkedin')).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run (FAIL)** — `npm run test:integration -- social-accounts-repository`

- [ ] **Step 7: Implement repository**

`src/lib/db/repositories/social-accounts.ts` :

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type SocialAccount, socialAccounts } from '../schema';

export type UpsertSocialAccountInput = {
  platform: string;
  externalId: string;
  displayName: string;
  accessToken: string;
  expiresAt: Date;
  scopes: string;
};

export async function getSocialAccount(
  userId: string,
  platform: string,
): Promise<SocialAccount | undefined> {
  const rows = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform)))
    .limit(1);
  return rows[0];
}

export async function upsertSocialAccount(
  userId: string,
  data: UpsertSocialAccountInput,
): Promise<SocialAccount> {
  const [row] = await db
    .insert(socialAccounts)
    .values({ id: createId(), userId, ...data })
    .onConflictDoUpdate({
      target: [socialAccounts.userId, socialAccounts.platform],
      set: {
        externalId: data.externalId,
        displayName: data.displayName,
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function deleteSocialAccount(userId: string, platform: string): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.platform, platform)));
}
```

- [ ] **Step 8: Run (PASS)** — `npm run test:integration -- social-accounts-repository`

- [ ] **Step 9: Commit**

```bash
git add src/lib/db/schemas/social-accounts.ts src/lib/db/repositories/social-accounts.ts \
  src/lib/db/schema.ts drizzle/ test/setup-integration.ts \
  test/integration/social-accounts-repository.test.ts
git commit -m "🤖 feat(spec-8): table social_accounts + repository (upsert/get/delete)"
```

---

## Task 3: OAuth client + runway (pures) + unit tests

**Files:** Create `src/lib/linkedin/oauth.ts`, `src/lib/linkedin/runway.ts`, `test/unit/linkedin-oauth.test.ts`, `test/unit/linkedin-runway.test.ts`.

- [ ] **Step 1: Write tests (TDD)**

`test/unit/linkedin-runway.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { runwayDays } from '@/lib/linkedin/runway';

describe('runwayDays', () => {
  test('futur ~60j', () => {
    const d = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    expect(runwayDays(d)).toBeGreaterThanOrEqual(59);
    expect(runwayDays(d)).toBeLessThanOrEqual(60);
  });
  test('passé = 0', () => {
    expect(runwayDays(new Date(Date.now() - 1000))).toBe(0);
  });
});
```

`test/unit/linkedin-oauth.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { getAuthorizeUrl } from '@/lib/linkedin/oauth';

describe('getAuthorizeUrl', () => {
  test('contient client_id, redirect_uri, scopes, state', () => {
    const url = new URL(getAuthorizeUrl('xyz-state'));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/linkedin\/callback$/);
    expect(url.searchParams.get('scope')).toContain('w_member_social');
    expect(url.searchParams.get('state')).toBe('xyz-state');
  });
});
```

- [ ] **Step 2: Run (FAIL)** — `npm run test:unit -- linkedin-runway linkedin-oauth`

- [ ] **Step 3: Implement `src/lib/linkedin/runway.ts`**

```ts
export function runwayDays(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000));
}
```

- [ ] **Step 4: Implement `src/lib/linkedin/oauth.ts`**

```ts
import { env } from '@/lib/env';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const SCOPES = 'openid profile email w_member_social';
const REDIRECT_PATH = '/api/linkedin/callback';

function redirectUri(): string {
  return `${env.APP_URL}${REDIRECT_PATH}`;
}

export function getAuthorizeUrl(state: string): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', env.LINKEDIN_CLIENT_ID ?? '');
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

export type LinkedInConnection = {
  externalId: string;
  displayName: string;
  accessToken: string;
  expiresAt: Date;
  scopes: string;
};

export type ExchangeFn = (code: string) => Promise<LinkedInConnection>;

export const exchangeCodeStub: ExchangeFn = async () => ({
  externalId: 'urn:li:person:STUB',
  displayName: 'Compte LinkedIn (stub)',
  accessToken: 'stub-token',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: SCOPES,
});

export const exchangeCodeReal: ExchangeFn = async (code) => {
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  });
  if (!tokenRes.ok) throw new Error(`LinkedIn token exchange failed: ${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token: string; expires_in: number };

  const meRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) throw new Error(`LinkedIn userinfo failed: ${meRes.status}`);
  const me = (await meRes.json()) as { sub: string; name?: string };

  return {
    externalId: `urn:li:person:${me.sub}`,
    displayName: me.name ?? 'LinkedIn',
    accessToken: token.access_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    scopes: SCOPES,
  };
};

export const exchangeCode: ExchangeFn =
  env.CONTENT_OS_LINKEDIN_STUB === '1' ? exchangeCodeStub : exchangeCodeReal;
```

- [ ] **Step 5: Run (PASS)** — `npm run test:unit -- linkedin-runway linkedin-oauth`

- [ ] **Step 6: Commit**

```bash
git add src/lib/linkedin/oauth.ts src/lib/linkedin/runway.ts \
  test/unit/linkedin-oauth.test.ts test/unit/linkedin-runway.test.ts
git commit -m "🤖 feat(spec-8): client OAuth LinkedIn (authorizeUrl + exchange réel/stub) + runwayDays"
```

---

## Task 4: connect-core + routes connect/callback

**Files:** Create `src/lib/linkedin/connect-core.ts`, `test/integration/linkedin-connect-core.test.ts`, `src/app/api/linkedin/connect/route.ts`, `src/app/api/linkedin/callback/route.ts`.

- [ ] **Step 1: Write connect-core test (TDD)**

`test/integration/linkedin-connect-core.test.ts` :

```ts
import { describe, expect, test } from 'vitest';
import { decryptToken } from '@/lib/crypto';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { connectFromCode } from '@/lib/linkedin/connect-core';
import type { ExchangeFn } from '@/lib/linkedin/oauth';
import { createTestUser } from './helpers/seed';

const fakeExchange: ExchangeFn = async () => ({
  externalId: 'urn:li:person:Z',
  displayName: 'Zoé',
  accessToken: 'clear-token-123',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: 'openid w_member_social',
});

describe('connectFromCode', () => {
  test('crée un social_account avec token chiffré', async () => {
    const userId = await createTestUser('cfc');
    await connectFromCode(userId, 'code', fakeExchange);
    const account = await getSocialAccount(userId, 'linkedin');
    expect(account?.displayName).toBe('Zoé');
    expect(account?.externalId).toBe('urn:li:person:Z');
    expect(account?.accessToken).not.toBe('clear-token-123'); // chiffré
    expect(decryptToken(account!.accessToken)).toBe('clear-token-123'); // déchiffrable
  });
});
```

- [ ] **Step 2: Run (FAIL)** — `npm run test:integration -- linkedin-connect-core`

- [ ] **Step 3: Implement `src/lib/linkedin/connect-core.ts`**

```ts
import { encryptToken } from '@/lib/crypto';
import { upsertSocialAccount } from '@/lib/db/repositories/social-accounts';
import type { ExchangeFn } from './oauth';

export async function connectFromCode(
  userId: string,
  code: string,
  exchange: ExchangeFn,
): Promise<void> {
  const conn = await exchange(code);
  await upsertSocialAccount(userId, {
    platform: 'linkedin',
    externalId: conn.externalId,
    displayName: conn.displayName,
    accessToken: encryptToken(conn.accessToken),
    expiresAt: conn.expiresAt,
    scopes: conn.scopes,
  });
}
```

- [ ] **Step 4: Run (PASS)** — `npm run test:integration -- linkedin-connect-core`

- [ ] **Step 5: Route `connect`**

`src/app/api/linkedin/connect/route.ts` :

```ts
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { getAuthorizeUrl } from '@/lib/linkedin/oauth';

export async function GET(): Promise<Response> {
  await requireUserId();
  const state = randomUUID();
  const jar = await cookies();
  jar.set('li_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  if (env.CONTENT_OS_LINKEDIN_STUB === '1') {
    return NextResponse.redirect(
      new URL(`/api/linkedin/callback?code=stub&state=${state}`, env.APP_URL),
    );
  }
  return NextResponse.redirect(getAuthorizeUrl(state));
}
```

- [ ] **Step 6: Route `callback`**

`src/app/api/linkedin/callback/route.ts` :

```ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { connectFromCode } from '@/lib/linkedin/connect-core';
import { exchangeCode } from '@/lib/linkedin/oauth';

export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const jar = await cookies();
  const expected = jar.get('li_oauth_state')?.value;
  jar.delete('li_oauth_state');

  const settings = new URL('/settings/connections', env.APP_URL);
  if (!code || !state || !expected || state !== expected) {
    settings.searchParams.set('error', 'state');
    return NextResponse.redirect(settings);
  }

  try {
    await connectFromCode(userId, code, exchangeCode);
    settings.searchParams.set('connected', '1');
  } catch {
    settings.searchParams.set('error', 'oauth');
  }
  return NextResponse.redirect(settings);
}
```

- [ ] **Step 7: Typecheck + build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

Expected : routes `/api/linkedin/connect` et `/api/linkedin/callback` listées.

- [ ] **Step 8: Commit**

```bash
git add src/lib/linkedin/connect-core.ts test/integration/linkedin-connect-core.test.ts \
  src/app/api/linkedin
git commit -m "🤖 feat(spec-8): routes OAuth connect/callback + connectFromCode (state cookie)"
```

---

## Task 5: settings/connections page + disconnect + sidebar

**Files:** Create `src/app/(app)/settings/connections/page.tsx`, `actions.ts`, `_components/disconnect-button.tsx`. Modify `src/components/settings/settings-sidebar.tsx`.

- [ ] **Step 1: Disconnect action**

`src/app/(app)/settings/connections/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { deleteSocialAccount } from '@/lib/db/repositories/social-accounts';

export async function disconnectLinkedInAction(): Promise<{ status: 'success' }> {
  const userId = await requireUserId();
  await deleteSocialAccount(userId, 'linkedin');
  revalidatePath('/settings/connections');
  return { status: 'success' };
}
```

- [ ] **Step 2: Disconnect button (Client)**

`src/app/(app)/settings/connections/_components/disconnect-button.tsx` :

```tsx
'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { disconnectLinkedInAction } from '../actions';

export function DisconnectButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await disconnectLinkedInAction();
          toast.success('Compte LinkedIn déconnecté');
        })
      }
    >
      {pending ? 'Déconnexion…' : 'Déconnecter'}
    </Button>
  );
}
```

- [ ] **Step 3: Page**

`src/app/(app)/settings/connections/page.tsx` :

```tsx
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { getSocialAccount } from '@/lib/db/repositories/social-accounts';
import { runwayDays } from '@/lib/linkedin/runway';
import { DisconnectButton } from './_components/disconnect-button';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const account = await getSocialAccount(userId, 'linkedin');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Connexions</h2>
        <p className="text-sm text-neutral-600">Comptes sociaux pour la publication.</p>
      </header>

      {sp.error && (
        <p className="text-sm text-red-600">
          {sp.error === 'state'
            ? 'Échec de la vérification (state). Réessaie.'
            : 'La connexion LinkedIn a échoué. Réessaie.'}
        </p>
      )}
      {sp.connected && <p className="text-sm text-green-700">Compte LinkedIn connecté.</p>}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">LinkedIn</p>
            {account ? (
              <p className="text-xs text-neutral-500">
                {account.displayName} ·{' '}
                {(() => {
                  const days = runwayDays(account.expiresAt);
                  return (
                    <span className={days <= 7 ? 'text-red-600' : ''}>
                      expire dans {days} jour{days > 1 ? 's' : ''}
                    </span>
                  );
                })()}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">Non connecté</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/linkedin/connect"
              className={buttonVariants({ variant: account ? 'outline' : 'default', size: 'sm' })}
            >
              {account ? 'Reconnecter' : 'Connecter LinkedIn'}
            </a>
            {account && <DisconnectButton />}
          </div>
        </div>
      </Card>
    </div>
  );
}
```

(Note : lien `<a href="/api/linkedin/connect">` natif — navigation pleine page nécessaire pour le redirect OAuth, pas un `<Link>` client. `Button` importé pour le typage de `buttonVariants` ; retirer l'import `Button` s'il est inutilisé.)

- [ ] **Step 4: Sidebar**

`src/components/settings/settings-sidebar.tsx` : ajouter dans `items` (après 'Visual templates') :

```ts
  { label: 'Connexions', href: '/settings/connections' },
```

- [ ] **Step 5: Typecheck + build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/settings/connections src/components/settings/settings-sidebar.tsx
git commit -m "🤖 feat(spec-8): page /settings/connections (runway + reconnecter/déconnecter) + lien sidebar"
```

---

## Task 6: E2E (stub) + lint/tsc + full suite

**Files:** Modify `playwright.config.ts`. Create `test/e2e/linkedin-connection.spec.ts`.

- [ ] **Step 1: Propager le stub au web E2E**

`playwright.config.ts` — `webServer.env` :

```ts
    env: { E2E_TESTING: 'true', RESEND_API_KEY: '', CONTENT_OS_LINKEDIN_STUB: '1' },
```

- [ ] **Step 2: E2E**

`test/e2e/linkedin-connection.spec.ts` (copier `signup`/`fetchMagicLink` depuis `media-gallery.spec.ts`) :

```ts
test.describe('Connexion LinkedIn', () => {
  test.describe.configure({ timeout: 120_000 });

  test('connecter (stub) puis déconnecter', async ({ page }) => {
    await signup(page, `pw-li-${Date.now()}@test.invalid`);
    await page.goto('/settings/connections');
    await expect(page.getByRole('heading', { name: 'Connexions' })).toBeVisible();
    await expect(page.getByText('Non connecté')).toBeVisible();

    await page.getByRole('link', { name: 'Connecter LinkedIn' }).click();
    // stub : connect → callback direct → redirect /settings/connections?connected=1
    await expect(page).toHaveURL(/\/settings\/connections/);
    await expect(page.getByText(/Compte LinkedIn \(stub\)/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/expire dans \d+ jour/)).toBeVisible();

    await page.getByRole('button', { name: 'Déconnecter' }).click();
    await expect(page.getByText('Non connecté')).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 3: Run E2E (stub)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null; npm run build 2>&1 | tail -2
CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e -- test/e2e/linkedin-connection.spec.ts 2>&1 | tail -12
```

Fix selectors inline si besoin (notamment le texte du compte stub, le lien Connecter).

- [ ] **Step 4: Lint + format + tsc + full suite**

```bash
npm run format && npm run lint && npx tsc --noEmit && npm test
```

Expected : tout vert.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts test/e2e/linkedin-connection.spec.ts
git commit -m "🤖 test(spec-8): e2e connexion LinkedIn (stub) + propage CONTENT_OS_LINKEDIN_STUB au web"
```

---

## Task 7: Full E2E + push + PR

- [ ] **Step 1: Full E2E (no regression)**

```bash
lsof -ti :3000 | xargs kill 2>/dev/null
CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e 2>&1 | tail -12
```

Re-run en solo tout test flaky (rate-limit signup).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin spec-8/linkedin-connection
gh pr create --base main --head spec-8/linkedin-connection --title "spec 8: connexion LinkedIn (OAuth + tokens chiffrés)" --body "$(cat <<'EOF'
## Summary
- Table social_accounts (token chiffré AES-256-GCM, URN membre, expiration), scopée user
- OAuth LinkedIn : /api/linkedin/connect (state cookie) + /api/linkedin/callback (échange → chiffre → upsert)
- /settings/connections : connecté/non connecté, « expire dans X jours », Reconnecter / Déconnecter
- Stub CONTENT_OS_LINKEDIN_STUB pour CI/E2E (compte factice, zéro appel LinkedIn)
- Zéro dépendance ajoutée (node:crypto, fetch natif)

1er des 3 chantiers LinkedIn (connexion → publication → calendrier).

Spec : docs/superpowers/specs/2026-05-24-spec-8-linkedin-connection-design.md
Plan : docs/superpowers/plans/2026-05-24-spec-8-linkedin-connection.md

## Test plan
- [ ] npm test (unit crypto/oauth/runway, integration repo + connect-core)
- [ ] CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e
- [ ] Manuel (vrai OAuth) : connecter un vrai compte LinkedIn en local, vérifier runway + déconnexion

## Notes
- Le vrai parcours OAuth n'est pas couvert par l'E2E (stub) — à tester manuellement avec un vrai compte.
- Redirect à enregistrer côté app LinkedIn : ${APP_URL}/api/linkedin/callback.
- Reconnexion manuelle (pas de refresh auto) ; publication = Spec 9.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI green ; ne pas merger sans Manu.**

```bash
gh run watch <run-id> --exit-status
```

---

## Critères de réussite globale

Cf. spec § Critères de réussite. Synthèse : connexion OAuth (stub en test, réel en manuel), token chiffré au repos, runway affiché, déconnexion, reconnexion (upsert), tenant isolation. `npm test` + `npm run test:e2e` verts, lint + tsc clean, CI verte, PR ouverte (pas de merge auto).
