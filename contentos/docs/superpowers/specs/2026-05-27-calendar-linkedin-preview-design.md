# Calendrier enrichi + aperçu LinkedIn

Vue calendrier agrandie où chaque post montre une miniature et deux lignes de texte, et
prévisualisation d'un post dans un rendu fidèle au fil LinkedIn, ouverte en modale depuis le
calendrier et réutilisable ailleurs (aperçu live dans l'éditeur de post).

## Objectifs

- Le calendrier mensuel est plus grand et lisible : chaque item de jour affiche la miniature de
  l'image du post + deux lignes de texte.
- Cliquer un post ouvre une modale de prévisualisation au skin LinkedIn (avatar, nom, sous-titre,
  texte avec « voir plus », image, compteurs), pour se projeter sur le rendu réel.
- La prévisualisation est un composant présentationnel réutilisable, employé aussi en aperçu live
  dans l'éditeur de post.

## Composants & responsabilités

### `LinkedInPostPreview` — composant présentationnel (`src/components/linkedin/post-preview.tsx`)

Rend un post au format fil LinkedIn. **Aucun accès base de données ni récupération de données** :
tout arrive par les props.

Props :

```ts
type LinkedInAuthor = { name: string; headline?: string; avatarUrl?: string };
type LinkedInStats = { reactions: number; comments: number; reposts: number };
type LinkedInPostPreviewProps = {
  author: LinkedInAuthor;
  content: string;
  image?: { url: string } | null;
  stats?: LinkedInStats; // défaut : placeholder cosmétique
};
```

Rendu : en-tête (avatar ou initiales si pas d'`avatarUrl`, nom, `headline`, « Maintenant · 🌐 »),
corps via `PostText`, image en pleine largeur si présente, ligne de compteurs
(réactions/commentaires/republications), barre d'actions (J'aime / Commenter / Partager).

Les `stats` sont des **placeholders cosmétiques** (valeur par défaut plausible, surchargeable) :
elles servent à se projeter, ce ne sont pas de vraies métriques.

### `PostText` — repli du texte (`src/components/linkedin/post-text.tsx`, `'use client'`)

Reproduit le « voir plus » de LinkedIn : le texte est tronqué à 3 lignes (`-webkit-line-clamp`),
le débordement est mesuré via une `ref` après montage, et le bouton « …voir plus » n'apparaît
**que** si le texte dépasse réellement. Le clic déplie le texte en place ; il n'y a pas de repli
ensuite (comportement du fil LinkedIn).

### `getAuthorIdentity(userId)` — identité réelle (`src/lib/linkedin/identity.ts`)

Helper serveur retournant `LinkedInAuthor` à partir des données réelles :

- **name** : `displayName` du compte LinkedIn connecté (`getSocialAccount(userId, 'linkedin')`) ;
  à défaut `brandName` (via `buildBrandContext`) ; à défaut le nom de l'utilisateur.
- **avatarUrl** : `brandLogoUrl` (via `buildBrandContext`) ; à défaut absent → initiales rendues
  par le composant.
- **headline** : `brandSignature` (via `buildBrandContext`) ; à défaut absent.

## Calendrier élargi

### Données — `src/lib/calendar/month-grid.ts` + repo

`CalendarItem` est enrichi :

```ts
type CalendarItem = {
  publicationId: string;
  postId: string;
  excerpt: string;       // 2 premières lignes du contentSnapshot
  thumbnailUrl: string | null; // media.assetKey du post lié, ou null
  status: string;
};
```

`excerpt` : les deux premières lignes non vides du `contentSnapshot`, tronquées proprement.
`buildMonthGrid` reste **pur** : il reçoit les publications déjà enrichies de leur miniature.

Nouveau repo `listPublicationsForCalendar(userId)` (`src/lib/db/repositories/publications.ts`) :
jointure publications → posts → media, retournant `Publication & { thumbnailUrl: string | null }`.
La miniature vaut `media.assetKey` (déjà une URL publique) quand le post a une image, sinon `null`.

### Rendu — `src/app/(app)/calendar/_components/month-calendar.tsx`

- Grille pleine largeur, cases agrandies (hauteur min ~150px).
- Chaque item (disposition retenue) : miniature 40px arrondie à gauche (placeholder neutre si
  `thumbnailUrl` est `null`) + deux lignes de texte (`excerpt`) à droite, fond coloré selon le
  statut (bleu = planifié, vert = publié).
- Jusqu'à 3 items par jour, puis « +N ».
- Chaque item est un `<Link href="/calendar/preview/[postId]">` qui déclenche la modale.

## Prévisualisation — modale via route interceptée

Pattern modale Next.js (slot parallèle + route interceptée) sous `src/app/(app)/calendar/` :

- `layout.tsx` — rend `{children}` et le slot `{modal}`.
- `@modal/default.tsx` — retourne `null`.
- `@modal/(.)preview/[postId]/page.tsx` — version interceptée : `PreviewDialog` (Dialog shadcn,
  `@/components/ui/dialog`) enveloppant `PostPreviewPane`. Fermeture (overlay / Échap) →
  `router.back()`.
- `preview/[postId]/page.tsx` — version pleine page (rechargement, lien direct, bouton retour
  natif), rend le même `PostPreviewPane`.
- `_components/post-preview-pane.tsx` (serveur) : `getPost` + `getMedia` + `getAuthorIdentity`,
  puis `<LinkedInPostPreview>` + un bouton **Modifier** (`Link` vers `/posts/[postId]`). `post`
  introuvable → `notFound()`.
- `_components/preview-dialog.tsx` (`'use client'`) : enveloppe Dialog, `onOpenChange(false)` →
  `router.back()`.

La modale affiche le **contenu live du post** (source unique, cohérente avec l'aperçu de
l'éditeur). L'identifiant de route est le `postId`.

## Aperçu live dans l'éditeur — `src/app/(app)/posts/[id]/`

La page d'édition affiche un panneau d'aperçu à côté de l'éditeur, alimenté par le contenu en
cours de frappe (état client de `post-editor.tsx`) + le visuel sélectionné + l'identité passée en
prop par la page serveur (`getAuthorIdentity`). Il réutilise `LinkedInPostPreview` tel quel ;
l'aperçu se met à jour à chaque frappe.

## Gestion des cas limites

- Post sans image : aperçu sans image ; miniature calendrier → placeholder neutre.
- Pas de compte LinkedIn connecté ni de marque renseignée : `getAuthorIdentity` retombe sur le nom
  de l'utilisateur + avatar à initiales + pas de `headline`.
- Post introuvable dans la prévisualisation : `notFound()`.
- Texte court (ne dépasse pas 3 lignes) : pas de bouton « voir plus ».

## Tests

- **Unitaires (vitest)** : `getAuthorIdentity` (chaîne de repli name/avatar/headline) ; construction
  de `excerpt` et mapping `CalendarItem` dans `month-grid` (2 lignes, statut, miniature null).
- **E2E (Playwright, happy path léger)** : depuis le calendrier, cliquer un post ouvre la modale ;
  « voir plus » déplie le texte ; le bouton Modifier mène à `/posts/[postId]`.

## Hors périmètre

- Vraies métriques d'engagement (les compteurs restent cosmétiques).
- Miniatures pour carrousels/vidéos (image seule pour l'instant ; placeholder sinon).
- Édition du post depuis la modale (le bouton Modifier renvoie vers l'éditeur existant).
