# Lot 2 — Auth + bibliothèque

## Contexte

Le lot 1 sert des ressources modulaires publiquement sur `/r/<slug>`. Le lot 2 transforme ces
ressources en **lead magnets** : pour accéder au contenu, le visiteur laisse son email et se
connecte par code à usage unique. Chaque accès ajoute la ressource à sa **bibliothèque**
personnelle. Manu peut réserver certaines ressources à des emails précis (ressources privées)
et choisir lesquelles sont mises en avant sur la page d'accueil.

## Objectif

Un visiteur arrive sur `/r/<slug>` depuis LinkedIn : il voit un teaser (titre, description,
cover) et un champ email. Il saisit son email, reçoit un code à 6 chiffres, le saisit, et le
contenu s'affiche — la ressource est ajoutée à sa bibliothèque. Au retour, la session le
reconnaît (durée ~1 an) et le contenu s'ouvre directement. Il peut se connecter via
`/connexion` pour retrouver sa bibliothèque, et se désinscrire d'une ressource.

## Périmètre

Dans le lot :

- Auth better-auth par **code OTP email** (plugin emailOTP), email seul, sessions ~1 an.
- Envoi des codes via **Resend** (template react-email).
- Modèle d'accès : ressources `public` / `private`, attribution des privées **par email**.
- Fonction pure `canAccess` + tests.
- Gating du reader : teaser + formulaire OTP pour les non-autorisés, contenu sinon.
- Bibliothèque : abonnement automatique à l'accès, page `/bibliotheque`, désinscription.
- Curation de la page d'accueil via un flag `featured`.
- Écrans `/connexion` et `/bibliotheque` ; modification du reader et de l'index du lot 1.

Hors lot :

- UI d'administration pour attribuer/mettre en avant des ressources (viendra via le MCP du
  lot 3 et le builder du lot 5 ; en lot 2 ça se fait par script/seed).
- Rôles et permissions avancés ; statistiques (lot 4).

## Authentification

better-auth, plugin **emailOTP** :

- `lib/auth.ts` : `betterAuth` avec `drizzleAdapter(db, { provider: "pg" })`, `nextCookies()`,
  plugin `emailOTP` (`otpLength: 6`, `expiresIn: 600`, `sendVerificationOTP` → Resend).
  Inscription implicite : un utilisateur inconnu qui valide un code est créé (lead capté).
- `session: { expiresIn: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 * 30 }` (~1 an, faible
  exigence de sécurité assumée).
- `lib/auth-client.ts` : `createAuthClient` avec `emailOTPClient()`.
- Route handler `app/api/auth/[...all]/route.ts` (handler better-auth).
- Friction minimale : **email seul**, aucun champ nom ni mot de passe.

Variables d'environnement ajoutées : `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`NEXT_PUBLIC_BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Modèle d'accès

- `resources.visibility` : `public` (toute personne connectée accède) ou `private` (réservé
  aux emails attribués).
- `resources.featured` (boolean, défaut `false`) : contrôle l'affichage sur la page d'accueil.
- `resource_access(resource_id, email)` : attribution d'une ressource privée par email
  **normalisé** (trim + minuscules). Fonctionne avant même que la personne ait un compte.
- **`canAccess(resource, email, grantedEmails)`** — fonction pure :
  - `resource.published` faux → `false`.
  - `email` absent (anonyme) → `false`.
  - `visibility === "public"` → `true`.
  - `visibility === "private"` → `grantedEmails` (normalisés) contient l'email normalisé.

Le contenu (pages/modules) n'est rendu que si `canAccess` est vrai. Sinon, teaser + gate.
L'attribution (`resource_access`) et la mise en avant (`featured`) se font par script/seed en
lot 2.

## Bibliothèque

- `subscriptions(id, user_id, resource_id, created_at)`, unique sur `(user_id, resource_id)`.
- Quand un utilisateur connecté accède à une ressource autorisée, un abonnement est **upserté**
  (idempotent, ne duplique pas).
- `/bibliotheque` : liste des ressources souscrites (titre, description, lien). Bouton **se
  désinscrire** → server action qui supprime la ligne `subscriptions`. La ressource n'est pas
  supprimée ; ré-accéder via le lien la rajoute. Bouton **se déconnecter**.

## Écrans et routes

Style brutaliste N&B du lot 1 réutilisé.

- `/r/[slug]` et `/r/[slug]/[...path]` : si `canAccess` faux → composant **gate** (teaser
  titre/description/cover + formulaire email puis code OTP, client component appelant
  `authClient`). Sinon → contenu, et upsert de l'abonnement.
- `/connexion` : formulaire email → code → redirection vers `/bibliotheque`.
- `/bibliotheque` : catalogue personnel, désinscription, déconnexion. Accès réservé aux
  connectés (redirige vers `/connexion` sinon).
- `/` (index) : liste les ressources `published && visibility === "public" && featured`,
  triées par date de création décroissante. Les autres n'y figurent pas mais restent
  accessibles par leur lien direct.

Le composant gate gère le flux en deux étapes (saisie email → envoi du code → saisie code →
`signIn.emailOtp`), puis rafraîchit la route : la page serveur se re-rend connectée et affiche
le contenu.

## Schéma de base de données

Réorganisation de `db/schema/` en modules cohérents, `index.ts` réexporte tout :

- `db/schema/auth.ts` : tables better-auth (`user`, `session`, `account`, `verification`),
  générées avec `@better-auth/cli` puis adaptées aux conventions du projet.
- `db/schema/content.ts` : `resources` (+ colonne `featured`), `pages`, `modules` (déplacés
  depuis l'actuel `index.ts`).
- `db/schema/access.ts` : `resource_access`, `subscriptions`.

## Email

`lib/email.ts` : wrapper Resend exposant `sendOtpEmail({ to, code })`. Template
`emails/otp-code.tsx` (react-email) : code bien visible, ton sobre. `RESEND_FROM_EMAIL` comme
expéditeur.

## Tests

Vitest, logique pure :

- `canAccess` : matrice (non-publiée, anonyme, publique, privée autorisée, privée non
  autorisée).
- `normalizeEmail` : trim, minuscules, idempotence.

## Critères d'acceptation

1. `npm test` passe (tests existants + nouveaux).
2. Sur une ressource publiée publique, un anonyme voit le teaser + le champ email, pas le
   contenu. Après saisie d'un code OTP valide (reçu par email), le contenu s'affiche et la
   ressource apparaît dans `/bibliotheque`.
3. Une ressource privée n'est accessible qu'aux emails présents dans `resource_access` ; un
   autre utilisateur connecté voit le gate sans pouvoir entrer.
4. La désinscription retire la ressource de `/bibliotheque` sans la supprimer ; y ré-accéder
   la rajoute.
5. La session persiste (~1 an) : un retour ultérieur ouvre le contenu sans nouveau code.
6. L'index n'affiche que les ressources `featured` publiques publiées.
7. `npm run build` et `npm run typecheck` passent.
