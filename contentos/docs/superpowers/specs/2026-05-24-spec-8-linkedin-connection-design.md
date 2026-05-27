# Spec 8 (Connexion LinkedIn) Design

> **Position dans la roadmap v2** : 8e spec, 1er des 3 chantiers « publication LinkedIn » (8 connexion → 9 publication/planification → 10 calendrier). Cette spec branche **l'authentification LinkedIn** : connecter un compte via OAuth, stocker le token chiffré, et l'afficher dans les settings avec le temps avant expiration. Aucune publication ici — c'est la fondation dont les Specs 9-10 dépendent.

## Objectif

1. **Connecter un compte LinkedIn** via OAuth 2.0 (Authorization Code) depuis les settings.
2. **Stocker le token chiffré** au repos (AES-256-GCM) + l'URN du membre (auteur requis pour publier en Spec 9).
3. **Afficher l'état dans les settings** : compte connecté (nom), « expire dans X jours », boutons Reconnecter / Déconnecter.

Le « temps avant refresh » de la demande = le compte à rebours avant expiration du token LinkedIn (~60 jours). Reconnexion **manuelle** (pas de refresh automatique — cohérent v1, et les refresh_tokens LinkedIn dépendent d'une approbation produit).

## Scope

**Inclus :**

- Migration additive : table `social_accounts` (token chiffré, URN, expiration), scopée user, unique `(userId, platform)`.
- Repository `social-accounts.ts` : `getSocialAccount`, `upsertSocialAccount`, `deleteSocialAccount`.
- Util de chiffrement `src/lib/crypto.ts` : AES-256-GCM (`encryptToken` / `decryptToken`), clé dérivée par SHA-256 de `TOKEN_ENCRYPTION_KEY`.
- Client OAuth LinkedIn `src/lib/linkedin/oauth.ts` (injectable + stub) : `getAuthorizeUrl`, `exchangeCode`, `fetchProfile`.
- Routes : `GET /api/linkedin/connect` (state cookie → redirect LinkedIn) et `GET /api/linkedin/callback` (vérifie state, échange code, récupère profil, chiffre + upsert, redirige settings).
- Page `/settings/connections` : carte LinkedIn (connecté/non connecté) + runway + Reconnecter/Déconnecter. Lien sidebar settings.
- Server Action `disconnectLinkedInAction`.
- Helper `runwayDays(expiresAt)` (jours avant expiration).
- Stub `CONTENT_OS_LINKEDIN_STUB=1` : `connect` court-circuite LinkedIn et crée directement un compte factice (pour CI/E2E).
- `env.ts` étendu : `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CONTENT_OS_LINKEDIN_STUB`.
- Tests : unit (crypto, authorizeUrl, runwayDays), integration (repo CRUD + tenant isolation, callback avec client stubbé, disconnect), e2e (connecter via stub → settings → déconnecter).

**Hors scope (Specs 9-10) :**

- Publication d'un post sur LinkedIn (API `/rest/posts`, upload média).
- Planification, calendrier, annulation, snapshot.
- Refresh automatique des tokens (refresh_token).
- Multi-comptes / multi-plateformes (un seul compte LinkedIn par user au MVP).
- Reconnexion automatique proactive (juste l'affichage + bouton manuel).

## Décisions cadres (validées en brainstorm)

| Décision | Choix |
|---|---|
| Découpage | 3 specs ; celle-ci = connexion uniquement |
| Expiration token | Reconnexion manuelle + compte à rebours « X jours » (comme v1) |
| Stockage token | Chiffré AES-256-GCM au repos, une colonne `accessToken` = base64(`iv ‖ authTag ‖ ciphertext`) |
| Clé de chiffrement | SHA-256 de `TOKEN_ENCRYPTION_KEY` → 32 octets (peu importe le format de la valeur env) |
| Base redirect | `APP_URL` (`${APP_URL}/api/linkedin/callback`) |
| Protection CSRF | `state` aléatoire en cookie HttpOnly, vérifié au callback |
| Scopes | `openid profile email w_member_social` |
| Tests sans LinkedIn | `CONTENT_OS_LINKEDIN_STUB=1` |

## Modèle de données

**Nouvelle table `social_accounts`** (`src/lib/db/schemas/social-accounts.ts`) :

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
    platform: text('platform').notNull(), // 'linkedin'
    externalId: text('external_id').notNull(), // URN membre, ex urn:li:person:abc
    displayName: text('display_name').notNull(),
    accessToken: text('access_token').notNull(), // blob chiffré (base64 iv|tag|cipher)
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

Barrel `schema.ts` : `export * from './schemas/social-accounts'`. Migration via `npm run db:generate` + `db:migrate`.

Note : la table `publications` a déjà une colonne `socialAccountId` (texte, sans FK contrainte) — on ne touche pas, elle sera reliée en Spec 9.

### Repository `src/lib/db/repositories/social-accounts.ts`

```ts
export type UpsertSocialAccountInput = {
  platform: string;
  externalId: string;
  displayName: string;
  accessToken: string; // déjà chiffré
  expiresAt: Date;
  scopes: string;
};

getSocialAccount(userId, platform): Promise<SocialAccount | undefined>
upsertSocialAccount(userId, data): Promise<SocialAccount>   // onConflict (userId, platform) → update
deleteSocialAccount(userId, platform): Promise<void>
```

`upsert` : `INSERT ... ON CONFLICT (user_id, platform) DO UPDATE SET ...` (re-connexion écrase l'ancien token).

## Chiffrement (`src/lib/crypto.ts`)

AES-256-GCM. Clé = `createHash('sha256').update(env.TOKEN_ENCRYPTION_KEY).digest()` (32 octets déterministes).

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
  return Buffer.concat([iv, tag, enc]).toString('base64'); // iv(12) | tag(16) | cipher
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

Round-trip testable en unit sans réseau ni DB.

## OAuth LinkedIn (`src/lib/linkedin/oauth.ts`)

Endpoints LinkedIn :
- Authorize : `https://www.linkedin.com/oauth/v2/authorization`
- Token : `https://www.linkedin.com/oauth/v2/accessToken`
- Profil (OpenID) : `https://api.linkedin.com/v2/userinfo` → `{ sub, name }`. URN = `urn:li:person:${sub}`.

```ts
const SCOPES = 'openid profile email w_member_social';
const REDIRECT_PATH = '/api/linkedin/callback';

export function getAuthorizeUrl(state: string): string {
  const u = new URL('https://www.linkedin.com/oauth/v2/authorization');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', env.LINKEDIN_CLIENT_ID!);
  u.searchParams.set('redirect_uri', `${env.APP_URL}${REDIRECT_PATH}`);
  u.searchParams.set('scope', SCOPES);
  u.searchParams.set('state', state);
  return u.toString();
}

export type LinkedInConnection = {
  externalId: string;     // urn:li:person:...
  displayName: string;
  accessToken: string;    // EN CLAIR (chiffré par l'appelant avant stockage)
  expiresAt: Date;
  scopes: string;
};

// Échange le code et récupère le profil. Injecté pour le stub/tests.
export type ExchangeFn = (code: string) => Promise<LinkedInConnection>;

export const exchangeCodeReal: ExchangeFn = async (code) => { /* POST token + GET userinfo */ };

export const exchangeCodeStub: ExchangeFn = async () => ({
  externalId: 'urn:li:person:STUB',
  displayName: 'Compte LinkedIn (stub)',
  accessToken: 'stub-token',
  expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
  scopes: SCOPES,
});

export const exchangeCode: ExchangeFn =
  env.CONTENT_OS_LINKEDIN_STUB === '1' ? exchangeCodeStub : exchangeCodeReal;
```

`exchangeCodeReal` : POST x-www-form-urlencoded (`grant_type=authorization_code, code, redirect_uri, client_id, client_secret`) → `{ access_token, expires_in }`. Puis GET userinfo avec `Authorization: Bearer`. Calcule `expiresAt = now + expires_in*1000`. Erreurs → throw avec message lisible.

### Routes

**`GET /api/linkedin/connect`** (`src/app/api/linkedin/connect/route.ts`) :
- `requireUserId()` (sinon redirect /signin).
- Génère `state = randomUUID()`, le pose en cookie HttpOnly `li_oauth_state` (SameSite=Lax, courte durée).
- En mode stub : redirige directement vers `/api/linkedin/callback?code=stub&state=<state>` (pas de LinkedIn).
- Sinon : redirige vers `getAuthorizeUrl(state)`.

**`GET /api/linkedin/callback`** (`src/app/api/linkedin/callback/route.ts`) :
- `requireUserId()`.
- Lit `code` + `state` (query) et le cookie `li_oauth_state`. Si absents ou mismatch → redirige `/settings/connections?error=state`.
- `conn = await exchangeCode(code)`.
- `upsertSocialAccount(userId, { platform: 'linkedin', externalId: conn.externalId, displayName: conn.displayName, accessToken: encryptToken(conn.accessToken), expiresAt: conn.expiresAt, scopes: conn.scopes })`.
- Efface le cookie state, redirige `/settings/connections?connected=1`.
- Erreur d'échange → redirige `/settings/connections?error=oauth`.

(Les routes utilisent `NextResponse.redirect` + `cookies()` de `next/headers`.)

## UI `/settings/connections`

**`src/app/(app)/settings/connections/page.tsx`** — Server Component :

- `getSocialAccount(userId, 'linkedin')`.
- **Connecté** : carte avec `displayName`, badge « Expire dans {runwayDays(expiresAt)} jours » (rouge si ≤ 7), bouton **Reconnecter** (lien `/api/linkedin/connect`) + **Déconnecter** (`<DisconnectButton>` client → `disconnectLinkedInAction`).
- **Non connecté** : texte + bouton **Connecter LinkedIn** (lien `/api/linkedin/connect`).
- Lit `searchParams` pour afficher un toast/bandeau succès (`connected=1`) ou erreur (`error=...`).

**Helper** `runwayDays(expiresAt: Date): number` dans `src/lib/linkedin/runway.ts` : `Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))`.

**Server Action** `disconnectLinkedInAction` (`src/app/(app)/settings/connections/actions.ts`) : `requireUserId` → `deleteSocialAccount(userId, 'linkedin')` → `revalidatePath('/settings/connections')`.

**Sidebar** : ajouter `{ label: 'Connexions', href: '/settings/connections' }` dans `src/components/settings/settings-sidebar.tsx`.

## Env (`src/lib/env.ts`)

```ts
LINKEDIN_CLIENT_ID: z.string().optional(),
LINKEDIN_CLIENT_SECRET: z.string().optional(),
TOKEN_ENCRYPTION_KEY: z.string().optional(),
CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
```

`.env.example` documenté. (L'utilisateur a déjà `LINKEDIN_CLIENT_ID/SECRET` + `TOKEN_ENCRYPTION_KEY` ; redirect `${APP_URL}/api/linkedin/callback` enregistré côté app LinkedIn.)

## Tests

### Unit (`vitest --project=unit`)

- `crypto.test.ts` : `encryptToken` → `decryptToken` round-trip ; deux chiffrements du même texte diffèrent (iv aléatoire) ; un blob altéré fait échouer le déchiffrement (authTag).
- `linkedin-oauth.test.ts` : `getAuthorizeUrl(state)` contient client_id, le bon redirect_uri (`${APP_URL}/api/linkedin/callback`), les scopes, le state.
- `runway.test.ts` : `runwayDays` — futur (~60j), passé (0), borne ≤ 7.

### Integration (`vitest --project=integration`)

- `social-accounts-repository.test.ts` : upsert (insert puis update sur reconnexion), get scopé user, delete ; tenant isolation (user B ne voit/supprime pas le compte de A).
- `tenant-isolation.test.ts` : étendre la sentinelle si pertinent.
- `linkedin-connect-core.test.ts` : un cœur testable `connectFromCode(userId, code, exchangeFn)` qui appelle exchange (stub) + chiffre + upsert → vérifie qu'un `social_account` chiffré est créé, et que `decryptToken(account.accessToken)` redonne le token clair.

### E2E Playwright (`test:e2e`)

- `linkedin-connection.spec.ts` (avec `CONTENT_OS_LINKEDIN_STUB=1`) : login → `/settings/connections` montre « non connecté » → clic « Connecter LinkedIn » → (stub : callback direct) → la page montre le compte connecté + « Expire dans ~60 jours » → clic « Déconnecter » → repasse « non connecté ».
- Le stub est propagé au serveur web E2E (`webServer.env` dans `playwright.config.ts`) en plus du global-setup worker.

## Décisions techniques tranchées

- **Token chiffré une colonne** (`base64(iv|tag|cipher)`) : un seul champ, pas de colonnes iv/tag séparées. GCM garantit l'intégrité (déchiffrement échoue si altéré).
- **Clé dérivée SHA-256** de `TOKEN_ENCRYPTION_KEY` : robuste quel que soit le format/longueur de la valeur env.
- **`state` en cookie HttpOnly** (pas de table `oauth_states`) : plus léger que v1, suffisant pour le CSRF OAuth (le cookie est lié au navigateur).
- **`exchangeCode` injectable + stub** : OAuth réel impossible à tester en CI ; le stub crée un compte factice et permet de couvrir tout le reste (UI, chiffrement, runway, déconnexion).
- **Reconnexion = re-run du flow** (upsert écrase) : pas de refresh token. Simple et robuste.
- **Un seul compte LinkedIn par user** (unique `(userId, platform)`).

## Migration & déploiement

1. `npm run db:generate` → migration additive `social_accounts`. `npm run db:migrate`.
2. Pas de nouvelle dépendance (fetch natif, `node:crypto`).
3. `.env` : `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (déjà présents), `APP_URL=http://localhost:3000`. Redirect `${APP_URL}/api/linkedin/callback` enregistré dans l'app LinkedIn (fait).
4. CI/E2E : `CONTENT_OS_LINKEDIN_STUB=1` (propagé au web E2E). Pas de secret LinkedIn requis en CI.
5. Le vrai parcours OAuth se teste manuellement en local (connexion d'un vrai compte) — non couvert par l'E2E stubbé.

## Critères de réussite

- `/settings/connections` accessible, montre « non connecté » au départ.
- Clic « Connecter LinkedIn » → (réel) redirige vers LinkedIn, consent, retour → compte connecté affiché ; (stub) compte factice connecté.
- Le token est stocké **chiffré** (jamais en clair en DB) ; `decryptToken` le restitue.
- « Expire dans X jours » affiché (rouge si ≤ 7).
- « Déconnecter » supprime le compte → repasse « non connecté ».
- Reconnexion écrase l'ancien token (upsert).
- Tenant isolation : un user ne voit/supprime jamais le compte d'un autre.
- `npm test` + `npm run test:e2e` (stub) verts. Lint + tsc clean. CI verte.

## Hors-scope rappelé

- Publication, planification, calendrier, annulation, snapshot (Specs 9-10).
- Refresh automatique des tokens.
- Multi-comptes / autres plateformes.
