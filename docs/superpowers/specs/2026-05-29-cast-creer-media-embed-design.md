# cast — créer un média depuis l'éditeur de post (embed iframe de media)

**Date** : 2026-05-29
**Projets touchés** : `cast` (consommateur), `media` (fournit la page embarquée)
**Statut** : conçu, à implémenter

## Problème

Depuis l'éditeur de post de **cast**, le picker média (`media-picker.tsx`) est en
lecture seule : il liste les médias existants de **media** (`GET /v1/media`) et en
attache un. Pour créer un nouveau média (upload, génération IA, PDF, template), il
faut quitter cast, aller dans media, créer, revenir, puis choisir. On veut créer un
média **sans quitter cast**, avec **parité totale** sur les 4 onglets de la modal
d'ajout de media.

## Décisions validées

- **Parité totale** : les 4 onglets de la modal media (Upload, Générer IA, Composer
  PDF, Rendre template) sont accessibles depuis cast.
- **Approche A — iframe** : media expose une page embarquée que cast charge en
  iframe. cast ne réimplémente **aucune** UI de création (respecte le principe
  atelier « cast ne crée aucun média… tout vit dans media »).
- **Après création → attache directe au post** : le média fraîchement créé est
  attaché au post en cours d'édition et la fenêtre se ferme.

## Architecture

```
cast (post editor)                          media
┌───────────────────────────┐               ┌──────────────────────────────┐
│ MediaPicker (Dialog)       │               │ /embed/new?parentOrigin=…     │
│  ┌─────────┬────────────┐  │   iframe      │  EmbeddedAddMedia (client)    │
│  │ Choisir │  Créer  ◀──┼──┼──────────────▶│   tabs: upload/generate/pdf/  │
│  └─────────┴────────────┘  │               │         template (réutilisés) │
│        ▲ postMessage       │◀──────────────┤   onCreated → postMessage     │
│        │ contentos:media-created  { id, url, kind, width, height }         │
│        ▼                   │               └──────────────────────────────┘
│ attachCreatedMediaAction   │
│   → setPostMedia (direct)  │
└───────────────────────────┘
```

### Flux

1. Dans le picker cast, l'utilisateur bascule sur l'onglet **« Créer un média »**.
2. cast affiche une `<iframe>` pointant sur
   `${MEDIA_ENGINE_URL}/embed/new?parentOrigin=${encodeURIComponent(APP_URL_origin)}`.
3. L'iframe (media) est authentifiée par le **cookie SSO cross-subdomain
   `.contentos.ch`** (same-site → cookie envoyé), exactement comme l'admin de media.
4. L'utilisateur crée un média (n'importe quel onglet). À la complétion, media
   `postMessage` au parent :
   `{ type: 'contentos:media-created', media: { id, url, kind, width, height } }`,
   avec `targetOrigin = parentOrigin` (validé côté media).
5. cast reçoit l'événement, **valide `event.origin`** (= origine de
   `MEDIA_ENGINE_URL`) et le type, puis appelle `attachCreatedMediaAction(postId,
   media)`.
6. `attachCreatedMediaAction` construit un `MediaRef` **directement depuis le
   payload** (pas de round-trip `/v1`) et `setPostMedia`. Toast + fermeture.

### Pourquoi attacher depuis le payload (et non re-résoudre par id via /v1)

En **preview**, cast résout `userId = preview-user` (court-circuit `isPreview`),
mais une iframe de **media prod** authentifie le **vrai** utilisateur SSO. Re-résoudre
l'id via `getMedia(preview-user, id)` renverrait 404. En attachant depuis le payload
(url R2 publique + kind), on est indépendant du `userId` et de l'environnement. C'est
le **même niveau de confiance** que le flux existant d'attache par URL (`MCP
attach_media_to_post` accepte n'importe quelle `media_url`), donc strictement plus sûr
(origine de l'iframe validée). LinkedIn récupère de toute façon les octets via
`fetch(mediaUrl)`.

## Contrat postMessage (source unique partagée par les deux projets)

```ts
// type d'événement
const MEDIA_CREATED = 'contentos:media-created';

type CreatedMedia = {
  id: string;            // id du média dans media (référence, peut servir plus tard)
  url: string;           // URL publique R2 (absolue http(s))
  kind: 'image' | 'video' | 'pdf' | 'render';
  width: number | null;
  height: number | null;
};

type MediaCreatedMessage = { type: typeof MEDIA_CREATED; media: CreatedMedia };
```

La même définition est dupliquée (petite, stable) côté cast et côté media — pas de
package partagé pour 15 lignes. Un test de chaque côté verrouille la forme.

## Changements — media

### 1. Actions de création renvoient un descripteur uniforme
- `uploadAction` : aujourd'hui `Promise<void>` → renvoie
  `{ id, url, kind, width, height } | { error }`. Garde `revalidatePath('/gallery')`
  (l'admin ignore la valeur de retour, comportement inchangé).
- `generateAction` / `editAction` : déjà `{ id, url, error }` → ajouter `kind:'image'`,
  `width`, `height`.
- `composePdfAction` : déjà `{ ok, id, url }` → ajouter `kind:'pdf'` + dims.
- `renderTemplateFromTemplateAction` : aujourd'hui `{ ok, url }` → ajouter `id`,
  `kind:'render'` + dims (le record de `renderTemplate` porte l'id).

Les dims (`width`/`height`) sont fournies si le record les porte, sinon `null` (cast
gère `null`).

### 2. Onglets acceptent un callback optionnel `onCreated`
Threader `onCreated?: (m: CreatedMedia) => void` dans `GenerateForm`, `Composer`,
`TemplateTab`, et un nouveau `UploadForm` (extrait du `<form>` inline de
`add-media-dialog.tsx`). Quand `onCreated` est fourni (mode embed) : l'appeler à la
complétion **au lieu** de la navigation `/gallery` (template) ou de l'affichage inline.
Quand absent (admin) : comportement actuel inchangé.

### 3. Route embarquée `/embed/new`
- `src/app/embed/new/page.tsx` (server) : `requireUserId()`, charge styles/images/
  templates/templateImages (comme `(admin)/gallery/new/page.tsx`), valide
  `?parentOrigin=` via `isAllowedParentOrigin`, rend `EmbeddedAddMedia`.
- `EmbeddedAddMedia` (client) : shell à onglets en **état local** (pas de `<Link>`,
  pas de navigation iframe), réutilise les 4 composants d'onglet avec
  `onCreated={post}` où `post` fait
  `window.parent.postMessage({ type: MEDIA_CREATED, media }, parentOrigin)`.
- Si `parentOrigin` invalide/absent → page d'erreur courte (refuse d'embarquer).

### 4. Allowlist d'origine + CSP frame-ancestors
- `isAllowedParentOrigin(origin)` (pur, testé) : autorise `https://cast.contentos.ch`,
  `https://*.preview.contentos.ch` (un label), et `http://localhost:*` en dev.
- `next.config.ts` : `headers()` pose sur `/embed/:path*`
  `Content-Security-Policy: frame-ancestors 'self' https://cast.contentos.ch https://*.preview.contentos.ch`
  (couvre prod cast → prod media, et previews). Pas de `X-Frame-Options` (déprécié,
  Next n'en pose pas).
- Middleware : `/embed/*` reste protégé (non exclu du matcher) → cookie requis en
  prod ; l'iframe l'a (same-site).

## Changements — cast

### 1. `attachCreatedMediaAction(postId, media)` (nouvelle server action)
Valide la forme du payload (url absolue http(s), kind connu), construit
`MediaRef = { media_id: media.id, media_url: media.url, media_kind: media.kind,
media_width: media.width, media_height: media.height }`, `setPostMedia(userId,
postId, ref)`, `revalidatePath`. Pas d'appel `/v1`.

### 2. MediaPicker : onglet « Créer un média »
- En-tête du Dialog : bascule **Choisir** (grille existante) / **Créer** (iframe).
- Onglet Créer : `<iframe src=…/embed/new?parentOrigin=…>` plein cadre + écouteur
  `message` : si `event.origin === embedOrigin` et `data.type === MEDIA_CREATED` →
  `attachCreatedMediaAction`, toast, `onOpenChange(false)`.
- Nouvelles props : `embedSrc` (base URL `${MEDIA_ENGINE_URL}/embed/new`),
  `embedOrigin` (origine pour valider `event.origin`), `parentOrigin` (= origine
  `APP_URL`). Calculées dans le server component du post et passées via `post-editor`.

### 3. Câblage des props
La page server du post calcule `embedSrc`/`embedOrigin`/`parentOrigin` depuis l'env
(`MEDIA_ENGINE_URL`, `APP_URL`) et les passe à `post-editor` → `MediaPicker`.

## Sécurité

- **Double validation d'origine** : media valide `parentOrigin` (allowlist) avant de
  poster ; cast valide `event.origin` à la réception.
- **CSP frame-ancestors** restreint qui peut embarquer media.
- **Auth** : l'iframe hérite du cookie SSO (same-site) ; aucune nouvelle surface
  d'auth. La route `/embed` reste derrière le middleware.
- **Confiance du payload** : équivalente au flux d'attache par URL déjà existant ;
  `attachCreatedMediaAction` valide que l'url est absolue http(s).

## Tests (TDD sur les coutures pures)

- **media** : `isAllowedParentOrigin` (accepte cast prod + preview wildcard ; rejette
  origine tierce, schéma non-https hors localhost).
- **cast** : construction/validation de `MediaRef` depuis un `CreatedMedia`
  (payload valide → ref ; url non absolue / kind inconnu → rejet).
- Le câblage iframe/postMessage est de l'intégration : vérifié sur la **preview**
  (build + `npm test` verts en CI ; e2e manuel sur les URLs preview).

## Hors périmètre

- Édition d'image (`edit`) depuis cast : l'onglet edit vit dans la galerie media, pas
  dans la modal d'ajout — non requis pour la parité demandée.
- Sélection multiple / création en lot.
- Partage d'un package npm pour le contrat postMessage (15 lignes dupliquées).

## Plan de vérification

1. `npm test` + `npm run build` verts dans `media` et `cast`.
2. Push branche → previews `cast-<branche>` et `media-<branche>`.
3. e2e manuel : depuis un post cast preview, onglet « Créer », tester les 4 onglets,
   vérifier l'attache automatique au post.
