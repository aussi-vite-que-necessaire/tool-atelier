# Spec 9 — Publication LinkedIn — Design

**Objectif** : depuis un post, publier sur LinkedIn maintenant ou à une date planifiée. Un snapshot immuable est figé au clic ; le post reste éditable mais marqué publié (one-shot) ; une planification peut être annulée.

## Périmètre

- Publier maintenant **ou** planifier (date/heure).
- Snapshot immuable figé **au clic** (texte + image attachée le cas échéant).
- Publication **texte + image** : si le post a un visuel, il est uploadé (workflow 3 étapes LinkedIn).
- **One-shot** : une fois publié, le post est marqué publié et le bouton Publier disparaît ; le post reste éditable (archive/réutilisation) mais l'édition n'affecte pas LinkedIn.
- Annuler une planification (tant qu'elle n'est pas en cours).

Hors périmètre : vue calendrier (Spec 10), édition d'un post LinkedIn déjà publié, refresh automatique de token (reconnexion manuelle, cf. Spec 8).

## Architecture

Tout passe par une queue worker `publish-linkedin`. « Publier maintenant » = job sans délai ; « Planifier » = job différé (`delay` BullMQ jusqu'à l'échéance). L'UI poll le statut via le hook existant `useJobPolling`. La ligne `publications` en base est la source de vérité.

*Alternatives écartées : publication synchrone dans la Server Action (risque de timeout sur l'upload image en 3 étapes, incohérent avec le pipeline async existant) ; scheduler/cron dédié (composant supplémentaire à opérer).*

## Données

La table `publications` (Spec 2) couvre déjà tout — aucune migration nécessaire.

Cycle de vie : `scheduled` → `queued` → `publishing` → `published` / `failed`.

Au clic (Publier ou Planifier), on crée une ligne `publications` avec le snapshot figé :
- `contentSnapshot` = `post.content` à cet instant ;
- `snapshotKeys` = `[media.assetKey]` si le post a un visuel attaché, sinon vide/null ;
- `mediaKind` = type du média (image) le cas échéant ;
- `socialAccountId` = id du compte LinkedIn connecté ;
- `platform` = `'linkedin'` ;
- `status` = `queued` (publier maintenant) ou `scheduled` + `scheduledFor`/`scheduledTz` (planifier).

Le snapshot est immuable dès la création : éditer le post ensuite ne modifie pas ce qui sera publié. Pour changer une publication planifiée : annuler puis re-planifier.

L'état « publié » / « planifié » d'un post est **dérivé** de la présence d'une publication active (statut non terminal ou `published`), sans nouveau champ sur `posts`. Un post a au plus une publication active à la fois.

## Composants

### `src/lib/linkedin/publish.ts`
Porté de la v1 (`content-os/src/social/linkedin/publish.ts`), adapté pour lire les bytes image depuis le storage (R2) au lieu du filesystem.
- API `https://api.linkedin.com/rest/posts`, en-têtes `LinkedIn-Version: 202405`, `X-Restli-Protocol-Version: 2.0.0`.
- Texte seul = 1 appel POST. Avec image = 3 étapes : `images?action=initializeUpload` → `PUT` des bytes (lus via `getStorage().get(assetKey)`) → POST avec `content.media.id`.
- URL externe construite depuis l'URN retourné : `https://www.linkedin.com/feed/update/{urn}/`.
- Erreurs typées `LinkedInPublishError` avec `kind` : `token_expired` (401), `rate_limit` (429), `invalid_content` (4xx), `platform_5xx` (5xx), `network`.
- **Stub `CONTENT_OS_LINKEDIN_STUB=1`** : `publishPost` retourne un faux URN/URL après une courte latence, sans appel réseau. Utilisé en CI/E2E.

L'URN auteur = `socialAccount.externalId` (déjà stocké sous la forme `urn:li:person:{sub}` en Spec 8). Le token est déchiffré via `decryptToken`.

### `src/lib/publications/publish-core.ts`
Fonctions « core » testables sans session ni Redis (le enqueue est injecté) :
- `snapshotForPost(userId, postId)` → construit le snapshot (charge le post, son média éventuel, le compte LinkedIn). Lève si pas de compte LinkedIn connecté.
- `publishNow(userId, postId, enqueue)` → crée la publication `queued` + enqueue immédiat.
- `schedulePublication(userId, postId, when, tz, enqueue)` → crée la publication `scheduled` + enqueue différé.
- `cancelPublication(userId, publicationId, dequeue)` → si `scheduled`/`queued` : retire le job + supprime la ligne. Sinon no-op/erreur.

### Queue + worker
- `src/lib/queue/client.ts` : nouvelle `publishLinkedinQueue = new Queue('publish-linkedin')`, payload `{ publicationId }`.
- `src/lib/queue/registry.ts` : enregistrer `'publish-linkedin'`.
- `src/worker/index.ts` : nouveau `Worker('publish-linkedin', makeProcessPublishLinkedin({ publish, storage, ... }))`.
- Processor (`src/worker/processors/publish-linkedin.ts`) : charge la publication → `publishing` → `publishPost(...)` → `published` (+ `externalPostId`/`externalUrl`/`publishedAt`) ou `failed` (+ `failureKind`/`lastError`).
- **Retry** via BullMQ : config `attempts` + backoff. Le processor **relève** l'erreur pour les `kind` transitoires (`rate_limit`, `platform_5xx`, `network`) → BullMQ ré-essaie ; pour les `kind` permanents (`token_expired`, `invalid_content`) il marque `failed` sans relever (pas de retry inutile).

### Server Actions + UI
- Actions (`src/app/(app)/posts/[id]/publish-actions.ts`) : `publishNowAction`, `scheduleAction(when)`, `cancelScheduleAction(publicationId)` — `requireUserId`, appellent le core avec l'enqueue réel, `revalidatePath`.
- Encart « Publication » sur `/posts/[id]` :
  - aucune publication active : **Publier maintenant** + **Planifier** (sélecteur date/heure) ;
  - `scheduled` : « Planifié pour le {date} » + **Annuler** ;
  - `queued`/`publishing` : « Publication en cours… » (polling jusqu'à l'état terminal) ;
  - `published` : « Publié le {date} » + lien vers le post LinkedIn (bouton masqué) ;
  - `failed` : message selon `failureKind` (ex. token expiré → « reconnecte ton compte LinkedIn ») + re-publier possible (rien n'est parti).

## Flux

1. L'utilisateur clique Publier/Planifier → Server Action → `publish-core` crée la publication (snapshot figé) + enqueue (immédiat ou différé).
2. Le worker traite : `publishing` → appel LinkedIn (texte, ou 3 étapes avec image) → `published`/`failed`.
3. L'UI poll et affiche l'état terminal (lien LinkedIn ou erreur).

## Gestion d'erreur

- Pas de compte LinkedIn connecté : la Server Action renvoie une erreur claire (« connecte d'abord ton compte LinkedIn »), pas de publication créée.
- Token expiré au moment de publier (401) : `failed` + `failureKind=token_expired`, l'UI invite à reconnecter (Spec 8).
- Erreurs transitoires : retry BullMQ ; au-delà des tentatives → `failed`.

## Tests

- **Unit** : construction du body LinkedIn (texte / texte+image), `classifyHttpError`, `buildExternalUrl`, stub `publishPost`.
- **Integration** : `publish-core` — snapshot figé correct, `publishNow`/`schedule` créent la bonne ligne, `cancel` supprime tant que non terminal, erreur si pas de compte LinkedIn (enqueue mocké, pas de Redis).
- **Worker** : processor avec stub → `published` (+ champs externes) ; erreur permanente → `failed` sans relever ; erreur transitoire → relève.
- **E2E** (`CONTENT_OS_LINKEDIN_STUB=1`) : créer/valider un post → Publier maintenant → statut `published` + lien affiché ; puis Planifier → Annuler.
