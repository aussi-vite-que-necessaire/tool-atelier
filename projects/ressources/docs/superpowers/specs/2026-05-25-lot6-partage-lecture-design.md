# Lot 6 — Partage (Open Graph) + aperçu admin + lecture mobile

## Contexte

La plateforme (lots 1-5) est fonctionnelle. Trois finitions à fort impact pour l'usage réel
(lead magnets partagés sur LinkedIn, audience surtout mobile, Manu qui crée le contenu) :
soigner l'aperçu des liens partagés, pouvoir prévisualiser une ressource avant publication, et
rendre la lecture confortable sur mobile.

## Périmètre

- **Open Graph par ressource** : métadonnées (titre, description, image cover) sur les pages
  reader → carte d'aperçu propre sur LinkedIn et autres.
- **Aperçu admin** : un admin peut voir le rendu d'une ressource en brouillon / privée /
  non-autorisée via `?preview=1`, sans enregistrer de vue ni d'abonnement.
- **Lecture mobile** : l'arbre de navigation passe dans un volet repliable sur petit écran.

Hors lot : intégration media-manager, durcissement auth, drag & drop, dashboard graphique.

## Open Graph

- `buildResourceMetadata({ title, description, coverImageUrl, url })` (pur, testé) construit
  l'objet `Metadata` Next : `title`, `description`, `openGraph` (title, description, url, type
  `article`, `images` si cover), `twitter` (`summary_large_image` si cover).
- `getResourceMeta(slug)` renvoie `{ title, description, coverImageUrl, published }` ou `null`.
- `generateMetadata` sur `/r/[slug]` et `/r/[slug]/[...path]` : si la ressource existe et est
  **publiée**, renvoie les métadonnées construites (URL = `${APP_URL}/r/<slug>`) ; sinon, titre
  générique « Ressources ». Les métadonnées s'affichent même pour une ressource gatée (le
  teaser est public).

## Aperçu admin

- `getResourceBySlug(slug, includeUnpublished?)` : avec `includeUnpublished`, renvoie aussi une
  ressource non publiée.
- `renderResourcePage(slug, path, { preview })` : `preview` n'est effectif que si la session est
  **admin**. En mode preview : la ressource est rendue même non publiée / privée / non
  autorisée (bypass du statut et de `canAccess`), **sans** `recordPageView`/`recordGateView` ni
  `addSubscription`. Un bandeau « Aperçu » signale le mode.
- Les routes reader lisent `searchParams.preview === "1"` et le passent à `renderResourcePage`.
- L'éditeur admin expose un lien « Aperçu » vers `/r/<slug>?preview=1`.

## Lecture mobile

- `ReaderShell` : sur `md+`, colonnes inchangées (arbre à gauche, contenu, sommaire à droite sur
  `lg`). Sur mobile, l'arbre est rendu dans un `<details>` repliable (« Pages », natif, sans
  JS) au-dessus du contenu ; la sidebar gauche est masquée (`hidden md:block`). Le sommaire
  reste desktop (`lg`).

## Tests

Vitest, logique pure : `buildResourceMetadata` (titre/description, présence d'`images` et de la
carte Twitter selon la cover).

Vérification end-to-end : les balises OG apparaissent dans le HTML d'une ressource publiée ; un
admin avec `?preview=1` voit le contenu d'un brouillon (404 sans preview) sans incrémenter les
stats ; le `<details>` mobile est présent.

## Critères d'acceptation

1. `npm test` passe.
2. `/r/<slug>` d'une ressource publiée contient `og:title`, `og:description`, `og:url` et
   `og:image` (si cover).
3. Une ressource en brouillon : `/r/<slug>` → 404 ; `/r/<slug>?preview=1` en admin → contenu
   rendu avec bandeau « Aperçu », sans nouvelle vue enregistrée.
4. Le HTML du reader contient le volet `<details>` mobile.
5. `npm run build`, `npm run typecheck`, `npm run lint` passent.
