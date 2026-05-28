# Lot 5 — Console d'administration (gestion + builder)

## Contexte

Les lots 1-4 servent, gatent, créent (par IA) et mesurent les ressources. Le lot 5 donne à
Manu une **console web protégée** pour tout piloter à la main : voir les statistiques, gérer la
publication / mise en avant / visibilité, attribuer les ressources privées, et éditer le
contenu (arbre de pages et modules) par formulaires. Tout réutilise la couche service (lot 3)
et les requêtes de stats (lot 4).

## Objectif

Un administrateur se connecte (OTP, comme tout utilisateur) ; si son compte est admin, il
accède à `/admin` : un tableau de bord listant les ressources avec leurs vues, et un éditeur
par ressource pour gérer métadonnées, accès privé, arborescence de pages et modules.

## Périmètre

Dans le lot :

- Identité admin : flag `is_admin` sur `user`, exposé dans la session ; garde `requireAdmin`.
- Zone `/admin` protégée (non-admin → redirigé).
- Tableau de bord : vue d'ensemble des stats + liste des ressources.
- Gestion de ressource : créer, éditer les métadonnées (titre, description, cover, visibilité,
  `published`, `featured`), supprimer.
- Builder par formulaires : arbre de pages (ajouter, renommer, supprimer, monter/descendre) et
  modules d'une page (ajouter typé, éditer, supprimer, monter/descendre).
- Accès privé : lister, attribuer et retirer des emails.
- Stats par ressource (vues, uniques, gate, par page).
- Bootstrap admin : script `db:make-admin <email>`.

Hors lot :

- API REST HTTP (le MCP et les server actions couvrent les besoins).
- Glisser-déposer, aperçu markdown en temps réel.
- Upload d'images (les URLs R2 sont saisies à la main ; l'intégration media-manager viendra).
- Gestion multi-admins fine (rôles, invitations).

## Identité admin

- Colonne `is_admin` (boolean, défaut `false`) sur la table `user`.
- Déclarée comme `additionalField` better-auth (`input: false`) pour apparaître dans
  `session.user`.
- **`requireAdmin()`** (serveur) : récupère la session ; si absente ou `!isAdmin`, redirige
  vers `/connexion`. Utilisé par le layout `/admin` et par chaque server action d'admin.
- Bootstrap : `db/make-admin.ts` (script tsx) passe `is_admin = true` pour un email donné.
  Aucune UI de promotion en lot 5.

## Routes

Groupe `app/admin/` (hors `(public)`), toutes derrière `requireAdmin` :

- `/admin` — tableau de bord : vue d'ensemble des stats + liste des ressources (badges
  publié/featured/visibilité, vues), liens « Éditer » et « Stats », bouton « Nouvelle ressource ».
- `/admin/r/[slug]` — éditeur d'une ressource : formulaire métadonnées, section accès privé
  (si `private`), arbre de pages (ajout/renommage/suppression/↑↓), stats de la ressource.
- `/admin/r/[slug]/p/[...path]` — éditeur d'une page : liste des modules (édition/suppression/↑↓)
  et ajout d'un module typé.

## Server actions

`lib/actions/admin.ts`, toutes protégées par `requireAdmin`, déléguant à la couche service du
lot 3 puis `revalidatePath` :

- ressources : `createResourceAction`, `updateResourceMetaAction`, `deleteResourceAction` ;
- pages : `addPageAction`, `renamePageAction`, `deletePageAction`, `movePageAction` (↑↓) ;
- modules : `addModuleAction`, `updateModuleAction`, `deleteModuleAction`, `moveModuleAction` (↑↓) ;
- accès : `grantAccessAction`, `revokeAccessAction`.

Le réordonnancement ↑↓ s'appuie sur un utilitaire **pur** `moveInList(ids, id, direction)`
(testé), puis sur les fonctions de réordonnancement de la couche service (`reorderModules`, et
une nouvelle `reorderPages(resourceSlug, parentPath, orderedChildIds)` symétrique).

Le contenu d'un module est construit depuis les champs du formulaire selon son type et validé
par `moduleInputSchema` (lot 3) avant écriture.

## Composants

- `ModuleForm` (client léger) : sélecteur de type + champs conditionnels (markdown/callout →
  zone de texte + variante ; image/video/file/embed → URL + libellés). Sert à l'ajout et à
  l'édition.
- Le reste est en Server Components + `<form action={serverAction}>` (boutons ↑↓ = formulaires).
- Style brutaliste N&B réutilisé (bordures, gras, mono).

## Tests

Vitest, logique pure :

- `moveInList(ids, id, "up"|"down")` : déplacement, bornes (premier ne monte pas, dernier ne
  descend pas), id absent.
- `buildModuleContent(type, fields)` : construit et valide le contenu d'un module depuis des
  champs de formulaire (cas valides et rejets).

Vérification end-to-end : un compte promu admin accède à `/admin` ; un non-admin et un anonyme
sont redirigés ; les pages de la console rendent les bonnes données (ressources, stats, arbre,
modules).

## Critères d'acceptation

1. `npm test` passe (tests existants + nouveaux purs).
2. `/admin` est inaccessible sans session admin (redirection) et accessible à un admin.
3. Le tableau de bord liste les ressources avec leurs vues ; l'éditeur affiche métadonnées,
   arbre de pages et modules.
4. Les actions (créer/éditer/supprimer ressource, pages, modules, ↑↓, attribuer/retirer accès)
   modifient l'état via la couche service.
5. `npm run build`, `npm run typecheck` et `npm run lint` passent.
