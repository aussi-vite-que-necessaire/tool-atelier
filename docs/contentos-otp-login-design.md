# Contentos — login par code OTP (design)

## Objectif

Le login de Contentos se fait par **code à usage unique (OTP) envoyé par email**, avec
exactement le **flux** du projet Ressources : on saisit son email, on reçoit un code à
6 chiffres, on le saisit, on est connecté. Le rendu reste le design system de Contentos
(shadcn/ui), pas l'esthétique de Ressources.

En environnement **preview** (jamais en prod), l'accès est **auto-loggé** : ouvrir l'app
connecte directement un utilisateur de test, sans email ni saisie de code.

## Périmètre

Concerné : moteur d'auth, client d'auth, écran `/signin`, email de connexion, détection
d'environnement, tests.

Hors périmètre : le plugin MCP/OAuth (`/api/mcp`, `.well-known/`), le worker BullMQ, le
schéma de base de données. La table `verification` de better-auth couvre déjà l'OTP — **aucune
migration**.

## Stack existante (rappel)

Next.js 16 (App Router, `standalone`) · better-auth 1.6.11 (plugins `magicLink` → `emailOTP`,
`mcp`) · Drizzle ORM (Postgres) · Resend (`src/lib/email/`) · Vitest + Playwright.

## Architecture

### 1. Moteur d'auth — `src/lib/auth/server.ts`

Le plugin `magicLink` est remplacé par `emailOTP`. `mcp` et `databaseHooks` (seed des défauts
utilisateur à la création) restent identiques.

```ts
emailOTP({
  otpLength: 6,
  expiresIn: 600, // 10 minutes
  generateOTP: isPreview ? () => PREVIEW_OTP : undefined,
  sendVerificationOTP: async ({ email, otp }) => {
    if (isPreview) return; // aucun email envoyé en preview
    await sendEmail({
      to: email,
      subject: 'Ton code de connexion à content-os',
      html: otpHtml(otp),
      text: `Ton code de connexion : ${otp} (valable 10 minutes).`,
    });
  },
})
```

- En preview, `generateOTP` rend un code déterministe (`PREVIEW_OTP`) et aucun email n'est
  envoyé : le code est connu côté serveur, ce qui permet l'auto-login.
- Hors preview, `generateOTP` est `undefined` (génération aléatoire par défaut de better-auth)
  et l'email part par Resend.

### 2. Client d'auth — `src/lib/auth/client.ts`

`magicLinkClient()` devient `emailOTPClient()`. Les exports `signIn`/`signOut`/`useSession` sont
conservés. Méthodes utilisées par l'UI :

- `authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })`
- `authClient.signIn.emailOtp({ email, otp })`

### 3. Écran de connexion — `src/app/(auth)/signin/`

`page.tsx` devient un **server component** qui sert de porte :

1. si une session existe → `redirect('/')` (ou la cible passée en query) ;
2. sinon si `isPreview` → `redirect('/api/preview-login?redirect=<cible>')` ;
3. sinon → rend `<OtpForm />`.

Nouveau **client component** `otp-form.tsx` (rendu shadcn : `Card`, `Input`, `Label`,
`Button`), flux deux-étapes :

- **Étape email** : champ email + bouton « Recevoir mon code » → `sendVerificationOtp`.
- **Étape code** : champ 6 chiffres (centré, monospace, `inputMode="numeric"`) + bouton
  « Se connecter » → `signIn.emailOtp` → `router.push(cible)`. Lien « Changer d'email » pour
  revenir à l'étape email. États `loading` et messages d'erreur (« Code invalide ou expiré. »).

Le dossier `src/app/(auth)/verify/` est **supprimé** : le flux tient sur une seule page.

### 4. Auto-login preview — `src/app/api/preview-login/route.ts`

Route handler `GET`, **active uniquement si `isPreview`** (sinon `redirect('/signin')`). Elle
pilote le moteur emailOTP côté serveur pour l'utilisateur de test fixe `preview@contentos.local` :

1. `auth.api.sendVerificationOTP({ body: { email: PREVIEW_USER, type: 'sign-in' } })` — stocke le
   code fixe (via `generateOTP`), n'envoie pas d'email ;
2. `auth.api.signInEmailOTP({ body: { email: PREVIEW_USER, otp: PREVIEW_OTP }, asResponse: true })`
   — crée l'utilisateur s'il n'existe pas (donc `seedUserDefaults` s'applique), crée la session,
   renvoie les en-têtes `Set-Cookie` ;
3. on recopie ces cookies sur une réponse de redirection vers la cible (`redirect` query, défaut `/`).

Résultat : en preview, ouvrir n'importe quelle page protégée mène à `/signin`, qui redirige vers
`/api/preview-login`, qui connecte et renvoie sur la cible. L'utilisateur arrive connecté.

### 5. Détection d'environnement — `src/lib/env.ts`

Ajout au schéma : `APP_ENV: z.string().optional()`. `deploy.sh` l'injecte (`prod` en prod, sinon
le slug de branche pour les previews). Helper exporté :

```ts
export const isPreview = env.APP_ENV !== undefined && env.APP_ENV !== 'prod';
```

**Garantie anti-fuite** : en prod, `APP_ENV === 'prod'` ⇒ `isPreview` faux. `NODE_ENV` vaut
`production` aussi bien en preview qu'en prod (même image) : `APP_ENV` est le seul discriminant
fiable. Le code fixe et l'auto-login ne peuvent donc jamais s'activer en prod. En local
(`APP_ENV` absent) : flux OTP réel (code visible via l'inbox in-memory ou les logs).

Constantes (dans `src/lib/auth/server.ts` ou un petit module dédié `src/lib/auth/preview.ts`) :

```ts
export const PREVIEW_USER = 'preview@contentos.local';
export const PREVIEW_OTP = '000000';
```

### 6. Email de connexion

Le template magic-link est remplacé par un template « code OTP » : HTML simple affichant le code
en grand, plus une variante texte. Esprit identique à Ressources, branding content-os. Sujet :
« Ton code de connexion à content-os ». Si Resend n'est pas configuré (`RESEND_API_KEY` absent),
le comportement actuel de `src/lib/email/` s'applique (inbox in-memory / log serveur).

## Gestion d'erreurs

- Envoi du code impossible (Resend en échec) : message « Envoi impossible. Réessaie. » à l'étape
  email, on reste à l'étape email.
- Code invalide/expiré : message « Code invalide ou expiré. », on reste à l'étape code.
- `allowedAttempts` (défaut 3 de better-auth) : au-delà, better-auth invalide le code ; l'UI
  affiche le message d'erreur standard et l'utilisateur peut redemander un code.

## Tests

- **E2E** `test/e2e/auth.spec.ts` : flux OTP réel — `/` redirige vers `/signin`, saisie de
  l'email → étape code, récupération du code depuis l'inbox in-memory (`/api/__test__/emails`,
  helper `fetchOtp` remplaçant `fetchMagicLink`), saisie → dashboard, puis logout → `/signin`.
- **Intégration** : `isPreview` est faux quand `APP_ENV` est absent ou `prod`, vrai sinon ; et
  `/api/preview-login` redirige vers `/signin` hors preview (pas de session créée).

## Décisions

- Utilisateur de test preview : `preview@contentos.local`. Code fixe preview : `000000`.
- Auto-login actif uniquement en preview déployé (pas en local, pas en prod).
- Pas de migration de base : la table `verification` couvre l'OTP.
