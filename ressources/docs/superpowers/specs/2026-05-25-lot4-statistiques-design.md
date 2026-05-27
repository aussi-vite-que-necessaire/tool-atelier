# Lot 4 — Statistiques de vue/usage

## Contexte

Les lots 1-3 servent, gatent et permettent de créer des ressources. Le lot 4 mesure leur
audience : combien de vues, combien de visiteurs uniques, et combien de personnes voient le
teaser (gate) sans (encore) accéder — le funnel du lead magnet. Les stats sont consultables
par Manu via le serveur MCP existant.

## Objectif

Chaque vue de page autorisée et chaque affichage du gate sont enregistrés comme événements.
Un outil MCP `get_stats` renvoie, par ressource ou en vue d'ensemble, les vues totales, les
visiteurs uniques, les impressions du gate et le détail par page.

## Périmètre

Dans le lot :

- Table d'événements `view_events` (append-only).
- Enregistrement des vues de page (autorisées) et des impressions de gate dans le reader,
  avec filtrage des requêtes de préchargement Next.
- Agrégation (fonction pure testée) : totaux, uniques, gate, par page.
- Outil MCP `get_stats` (par ressource et vue d'ensemble) + couche de requêtes.

Hors lot :

- Suivi des téléchargements de fichiers et clics d'embeds (nécessite de l'instrumentation
  côté client).
- Dashboard visuel (viendra avec le builder, lot 5).
- Séries temporelles avancées, déduplication des visiteurs anonymes (pas d'identifiant
  anonyme stocké).

## Modèle de données

Table `view_events`, en append-only :

| Colonne       | Type        | Notes                                                        |
| ------------- | ----------- | ------------------------------------------------------------ |
| `id`          | uuid (pk)   |                                                              |
| `resource_id` | uuid (fk)   | → `resources.id`, `on delete cascade`                        |
| `page_id`     | uuid null   | → `pages.id`, `on delete cascade` ; null pour un `gate_view` |
| `user_id`     | text null   | → `user.id`, `on delete set null` ; null si anonyme          |
| `type`        | text        | `page_view` ou `gate_view`                                   |
| `created_at`  | timestamptz | défaut `now()`                                               |

Index sur `(resource_id, created_at)`. Aucune PII au-delà de l'utilisateur authentifié (pas
d'IP, pas d'empreinte).

## Enregistrement

Dans `app/(public)/r/[slug]/render.tsx`, après résolution de l'accès :

- accès autorisé → `recordPageView(resourceId, pageId, userId)` ;
- gate affiché → `recordGateView(resourceId, userId | null)` (anonyme, ou connecté non
  autorisé).

**Filtrage prefetch** : `isPrefetchRequest(headers)` (pur, testé) renvoie vrai si la requête
porte `Next-Router-Prefetch: 1`, `Sec-Purpose: prefetch` ou `Purpose: prefetch`. Dans ce cas
on n'enregistre rien (le préchargement Next ne doit pas gonfler les compteurs).

L'enregistrement est encapsulé dans un `try/catch` qui avale l'erreur (avec log serveur) : une
écriture de statistique défaillante ne casse jamais l'affichage de la ressource.

## Lecture et agrégation

`lib/stats/` :

- `aggregate.ts` — **`aggregateResourceStats(events, pages)`** (pur) : depuis les lignes
  d'événements d'une ressource et la liste de ses pages (id, titre, chemin), calcule
  `{ totalPageViews, uniqueViewers, gateImpressions, perPage: [{ pageId, title, path, views }] }`.
  `uniqueViewers` = nombre de `user_id` distincts sur les `page_view`.
- `queries.ts` :
  - `getResourceStats(slug, sinceDays?)` : récupère la ressource, ses pages, ses événements
    (filtrés sur la fenêtre optionnelle), puis appelle l'agrégateur pur.
  - `getStatsOverview()` : agrégation SQL (`group by resource_id, type`) renvoyant pour chaque
    ressource ses vues de page et impressions de gate.

L'agrégation par ressource se fait en JS (volume modéré, et c'est testable) ; la vue
d'ensemble utilise un `group by` SQL pour rester efficace sur l'ensemble des ressources.

## Exposition (MCP)

Outil `get_stats` ajouté au serveur MCP existant (`/api/mcp`, clé API) :

- `{ slug?, sinceDays? }` ;
- avec `slug` → stats détaillées de la ressource (totaux, uniques, gate, par page) ;
- sans `slug` → vue d'ensemble de toutes les ressources.

## Tests

Vitest, logique pure :

- `aggregateResourceStats` : totaux, visiteurs uniques (dédup `user_id`), impressions gate,
  ventilation par page.
- `isPrefetchRequest` : vrai pour les en-têtes de préchargement, faux sinon.

Vérification end-to-end : créer une ressource (MCP), générer des vues (reader authentifié) et
une impression de gate (anonyme), puis `get_stats` renvoie les bons compteurs.

## Critères d'acceptation

1. `npm test` passe (tests existants + nouveaux purs).
2. Une vue de page autorisée crée un `page_view` ; un affichage de gate crée un `gate_view` ;
   une requête de préchargement n'enregistre rien.
3. `get_stats { slug }` renvoie vues totales, visiteurs uniques, impressions gate et détail par
   page cohérents avec les vues générées.
4. `get_stats` sans `slug` renvoie la vue d'ensemble de toutes les ressources.
5. `npm run build` et `npm run typecheck` passent.
