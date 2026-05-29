# Seed preview + opérateurs de test + connexion réelle en preview

**Date** : 2026-05-29
**Périmètre** : `auth`, `ressources`, `media`, `cast`, `docs`, `scripts/deploy.sh`
**Statut** : design validé (brainstorm)

## Problème

Les previews des apps de la suite (`ressources`, `media`, `cast`, `docs`) arrivent
**vides** : pas de données pour tester de manière réaliste. Et chaque app
**court-circuite** l'auth en preview (`if (isPreview) return { user: { id: "preview-user" } }`),
donc tout le monde est le même utilisateur figé — impossible de vérifier
l'**isolation des données** entre deux opérateurs (« est-ce qu'on peut accéder
aux données les uns des autres ? »).

## Objectif

En **preview uniquement** (jamais en prod) :

1. **Seeder des données** dans `ressources`, `media`, `cast` (et donc `docs` via le
   backend partagé de `ressources`) — pour tester avec du contenu plutôt que du vide.
2. Toujours provisionner **deux opérateurs** (`accountType=operator`) avec chacun
   ses propres données, pour vérifier l'isolation.
3. Provisionner un **abonné** (`accountType=audience`) pour la preview de `docs`
   (app publique de consommation), abonné au contenu des deux opérateurs.
4. **Revoir l'auto-connexion** : on reste auto-connecté par défaut (zéro friction),
   mais on peut se **déconnecter** et se **reconnecter** comme l'un ou l'autre des
   utilisateurs via le vrai flux auth (email + code `000000`).

## Décisions structurantes (validées)

1. **Vraie connexion via auth en preview** (pas de simulation côté client). Les
   previews clients font une vraie `get-session` contre un auth de preview seedé.
2. **Auth de preview par branche** : `deploy.sh` injecte
   `AUTH_URL=https://auth-<branche>.preview.contentos.ch` dans le `.env` des clients
   en preview. Marche de bout en bout dès que la branche inclut `auth` (cette
   feature touche `auth`, donc OK). Pas de service auth toujours-debout à maintenir.
3. **Auto-connect + marqueur au logout** : fresh preview → auto-connecté ; après
   logout, un marqueur suite-wide bascule en mode « choisir l'utilisateur ».

## Identités de preview (convention partagée)

Pas de package partagé entre projets → ces constantes sont **dupliquées à
l'identique** dans le `preview.ts` de chaque projet concerné, et **doivent** rester
synchronisées. Les `id` sont stables et réutilisés tels quels côté `auth` (table
`user`) **et** côté seeds clients (FK `operatorId` / `userId`).

| Rôle      | `id`            | email            | `accountType` | Usage                                   |
|-----------|-----------------|------------------|---------------|-----------------------------------------|
| Opérateur 1 | `preview-op-1`  | `user1@avqn.ch`  | `operator`    | auto-connect des apps admin             |
| Opérateur 2 | `preview-op-2`  | `user2@avqn.ch`  | `operator`    | second opérateur (test d'isolation)     |
| Audience    | `preview-aud-3` | `user3@avqn.ch`  | `audience`    | auto-connect de `docs`, abonné à op1+op2 |

Code OTP en preview : `000000` (déjà en place, `generateOTP` constant hors prod).

> Note : l'ancien `PREVIEW_USER_ID = "preview-user"` disparaît. Les bases preview
> étant droppées + reseedées à chaque déploiement, aucune migration de données.

## Composant : `auth` (provider central) — preview only

### Seed (`scripts/seed.mjs`)
- Garde explicite en tête : si `APP_ENV === 'prod'` → log + exit 0 (défense en
  profondeur ; `deploy.sh` saute déjà le seed en prod).
- Insère les 3 utilisateurs dans la table BetterAuth `user` : `id`, `email`,
  `name`, `emailVerified=true`, `accountType` (op1/op2 = `operator`, aud3 =
  `audience`). Idempotent (`ON CONFLICT (id) DO UPDATE` sur email/name/accountType).
- Login par OTP ne requiert pas de ligne `account` (pas de mot de passe) ; la
  session est créée au moment du login. Vérifier les colonnes exactes de `user`
  (notamment `account_type`) au moment de l'implémentation.

### Auto-connexion : `GET /preview-login?user=1|2|3&redirect=<url>`
- **Preview only** (sinon 404/redirect vers `/sign-in`).
- Mappe `user` → l'identité correspondante, ouvre une **vraie session BetterAuth**
  pour cet utilisateur (cookie partagé `.preview.contentos.ch`), puis `302` vers
  `redirect`. `redirect` **whitelisté** aux domaines de la suite (même logique que
  `safeRedirect` de la page sign-in), défaut `/`.
- Mécanique de création de session côté serveur : à arbitrer en implémentation
  (API serveur BetterAuth, ou flux OTP `send`+`verify` joué côté serveur avec
  `000000`). Le helper doit retourner les `Set-Cookie` de session.

### Déconnexion : `GET /preview-logout?redirect=<url>`
- **Preview only.** Efface la session BetterAuth **et** pose le marqueur
  `cos_preview_login=manual` (cookie domain `.preview.contentos.ch`, lisible par
  toutes les apps de la suite en preview). Puis `302` vers `/sign-in` (chooser).

### Chooser : page `/sign-in` (preview)
- En preview, au-dessus du formulaire email existant, afficher des **boutons de
  connexion rapide** : « Entrer comme user1 », « user2 », « user3 (audience) »,
  liens vers `/preview-login?user=N&redirect=<redirect courant>`.
- Le formulaire email + `000000` reste disponible (déjà fonctionnel).
- En preview, à l'affichage du chooser, poser le marqueur `cos_preview_login=manual`
  (pour que rester sur le chooser ne re-déclenche pas l'auto-connect).

## Composant : clients (`ressources`, `media`, `cast`, `docs`)

### Suppression du court-circuit preview
- `lib/.../session.ts` : retirer `if (isPreview) return { user: { id: PREVIEW_USER_ID } }`.
  En preview, faire la **vraie** `get-session` HTTP vers `AUTH_URL` (comme prod).
- `middleware.ts` : retirer `if (isPreview) return NextResponse.next()`. Gater
  comme en prod.

### Redirection « pas de session » (helper partagé par projet)
Quand aucune session n'est trouvée, calculer la cible de redirection :
- **prod** : `${AUTH_URL}/sign-in?redirect=<back>` (inchangé).
- **preview**, marqueur `cos_preview_login` **absent** :
  `${AUTH_URL}/preview-login?user=<défaut>&redirect=<back>` → **auto-connect**.
  - `<défaut>` = `1` pour les apps admin (`ressources`, `media`, `cast`) ; `3`
    pour `docs`.
- **preview**, marqueur **présent** : `${AUTH_URL}/sign-in?redirect=<back>` → chooser.

Le marqueur est lu depuis les cookies de la requête (disponibles via les `headers`
passés à `fetchSession` / `NextRequest.cookies` dans le middleware). `back` est
reconstruit depuis `APP_URL` + path + search (comme l'actuel `middleware.ts` de
`docs`, pour ne pas fuiter l'URL interne du conteneur).

### Déconnexion
- Le « se déconnecter » de chaque app pointe, **en preview**, vers
  `${AUTH_URL}/preview-logout?redirect=<APP_URL>`. En prod : flux de sign-out
  existant inchangé.

### MCP (preview)
- Les outils MCP qui prennent un `userId` figé en preview (`PREVIEW_USER_ID`)
  prennent désormais l'**opérateur 1** (`preview-op-1`) par défaut.

### docs (spécificités)
- App publique « audience » : pas d'admin. Auto-connect = **user3** (audience).
- Connecté en user3, la bibliothèque/le compte montrent le contenu auquel user3 est
  abonné (op1 + op2). On peut se déconnecter pour browser en anonyme, ou se
  reconnecter comme n'importe quel utilisateur via le chooser.
- `db/schema` + `db/index.ts` restent synchronisés depuis `ressources`
  (`sync-shared.sh`) — **non modifiés** ici. `session.ts`/`middleware.ts`/`preview.ts`
  de docs sont **propres à docs** (hors noyau partagé) → éditables séparément.

## Composant : seeds de données (preview only, jamais prod)

Garde anti-prod explicite en tête de **chaque** seed (`APP_ENV === 'prod'` → exit 0),
en plus du saut déjà fait par `deploy.sh`.

### `ressources` (`db/seed.ts`)
- Deux opérateurs : `preview-op-1` (handle `user1`) et `preview-op-2` (handle `user2`),
  chacun avec son jeu de ressources/pages/modules (mix `public` / `private`,
  publiées / brouillons / featured). Espaces publics `/o/user1`, `/o/user2`.
- Audience : `preview-aud-3` abonné aux deux opérateurs —
  - `audienceMembers` : (op1, aud3) et (op2, aud3) ;
  - `subscriptions` : aud3 → quelques ressources d'op1 et d'op2 ;
  - `resourceAccess` : `user3@avqn.ch` → une ressource `private` (test du gating par email).
- Idempotent (delete-by-key puis insert, comme l'actuel seed).
- → bénéficie aussi à **docs** (même base, `db.shared: ressources`) : pas de seed propre à docs.

### `media` (`scripts/seed.mjs`)
- Marque + styles visuels + charte + template LinkedIn pour **chaque** opérateur
  (`preview-op-1`, `preview-op-2`), ids de seed distincts par user. Idempotent
  (`ON CONFLICT DO NOTHING`).

### `cast`
- `lab.json` : **ajouter** `"seed": "node scripts/seed-preview.mjs"` (ou équivalent
  tsx). Aujourd'hui `cast` n'a pas de clé `seed` → `deploy.sh` ne seede rien.
- Script de seed : seede du contenu d'exemple (réutilise `seedDev(userId)` /
  `seedRedaction`) pour `preview-op-1` **et** `preview-op-2`. Multi-image → le seed
  tourne via l'image du rôle `web` (déjà géré par `deploy.sh`).
- `seedUserDefaults(userId)` (au login, dans `session.ts`) continue de fonctionner
  pour qui se connecte.

### `docs`
- Aucun seed propre (backend partagé `ressources`). `lab.json` inchangé.

## Composant : `scripts/deploy.sh`

- En preview (`ENV != prod`), écrire dans le `.env` du projet, de façon
  **autoritative** (après les secrets, comme `APP_URL`) :
  `AUTH_URL=https://auth-${ENV}.preview.contentos.ch`.
- En prod : ne rien injecter (les clients gardent leur défaut `https://auth.contentos.ch`).
- Harmless pour les projets sans auth (variable ignorée).

## Stratégie de tests (TDD)

- **auth**
  - seed : insère 3 users avec bons `accountType` ; idempotent ; **no-op si `APP_ENV=prod`**.
  - `preview-login`/`preview-logout` : 404/redirect hors preview ; redirect whitelisté.
- **clients (unitaire)**
  - helper de redirection : prod → `/sign-in` ; preview sans marqueur → `/preview-login?user=<défaut>` ;
    preview avec marqueur → `/sign-in`. Défaut `1` (admin) vs `3` (docs).
  - `fetchSession` mappe correctement `accountType` (`operator` / sinon `audience`).
- **seeds (unitaire/intégration)**
  - garde anti-prod : avec `APP_ENV=prod`, le script n'écrit rien et sort 0.
  - (où une base de test est dispo) le seed crée bien les données des deux
    opérateurs + l'abonnement de user3.

## Hors périmètre

- Pas de service auth de preview « toujours debout » (décision : par branche).
- Pas de changement du flux d'auth prod ni du modèle de secrets.
- e2e Playwright mutualisés : hors sujet (cf. `docs/ideas/2026-05-28-e2e-mutualises.md`).
- Comportement de l'auth en **local** (dev) : inchangé (le court-circuit retiré ne
  concernait que la preview).
