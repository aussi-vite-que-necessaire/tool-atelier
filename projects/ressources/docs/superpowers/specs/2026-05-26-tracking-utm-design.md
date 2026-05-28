# Tracking de provenance (UTM) — design

Savoir d'où viennent les visiteurs d'une ressource : quelle plateforme et quel post
amènent du trafic, et lesquels convertissent en utilisateurs débloqués. Les liens posés
dans les contenus portent des paramètres UTM standard ; la plateforme les capte, les
attribue en *first-touch*, et les restitue dans les dashboards admin et l'outil MCP `get_stats`.

## Convention de liens

On suit le standard UTM (Google), compatible avec tout outil d'analytics :

- `utm_source` — la plateforme d'où vient le clic (`linkedin`, `newsletter`, `twitter`).
- `utm_campaign` — le contenu précis (`post-automatisation`, `carrousel-mai`).
- `utm_medium` — le canal (`social`, `email`).

Alias court : `?src=` est accepté comme synonyme de `utm_source` pour poser un code unique
rapidement. Exemple de lien : `https://ressources.avqn.ch/r/guide-ia?utm_source=linkedin&utm_medium=social&utm_campaign=post-auto`.

Normalisation à la capture : `trim`, minuscules, longueur plafonnée (64 caractères) pour
éviter les doublons de casse et les valeurs aberrantes. Une valeur vide après normalisation
est traitée comme absente.

## Modèle d'attribution : first-touch via cookie

Le code source n'est présent que sur le **premier** clic. Pour créditer la conversion (déblocage
par OTP) et la navigation ultérieure à la source d'origine, on mémorise le premier UTM rencontré
dans un cookie de première partie.

- **Cookie** `lab_ref` : JSON compact `{ s, m, c, t }` (source, medium, campaign, timestamp ISO).
  `httpOnly`, `sameSite=lax` (survit à la navigation depuis un lien externe et au flow OTP),
  `secure` en prod, `path=/`, `maxAge` 90 jours.
- **First-touch** : le cookie n'est posé que s'il est absent. Un second lien tagué ne l'écrase pas.

## Stockage

Trois colonnes nullables `source`, `medium`, `campaign` (`text`) ajoutées à **deux** tables,
chacune portant l'attribution là où elle a un sens :

- `view_events` — l'attribution du trafic. Chaque `gate_view` et `page_view` porte le trio lu
  dans le cookie au moment de l'événement. Répond à « d'où viennent les gens » et « qu'est-ce qui
  génère le plus de trafic » (impressions + vues par source/campagne, y compris pour les visiteurs
  qui ne débloquent jamais).
- `subscriptions` — l'attribution de l'acquisition. Le trio est figé une seule fois, à la création
  de la subscription (le déblocage = la conversion ; l'insert est idempotent via
  `onConflictDoNothing` sur `(userId, resourceId)`). Répond à « quel post / quelle source m'a
  ramené cet utilisateur ».

Colonnes nullables, aucune rétro-alimentation. Migration Drizzle générée puis appliquée selon
`docs/DEPLOY.md`.

## Flux de bout en bout

1. Visiteur clique `…/r/guide-ia?utm_source=linkedin&utm_medium=social&utm_campaign=post-auto`.
2. **Middleware** (`middleware.ts`, matcher `/r/:path*`) : lit les UTM (ou l'alias `src`) de la query.
   Si présents et qu'aucun cookie `lab_ref` n'existe encore, pose le cookie first-touch normalisé.
3. **Reader** (`render.tsx`) : lit `lab_ref` via `cookies()` et le transmet aux enregistrements.
   - Chemin gate : `recordGateView(resourceId, userId, ref)` → `view_event` avec le trio.
   - Chemin accès : `addSubscription(userId, resourceId, ref)` → trio figé first-touch à l'insert ;
     `recordPageView(resourceId, pageId, userId, ref)` → `view_event` avec le trio.
4. **Agrégation / requêtes** restituent les ventilations (voir Dashboards).

Les garde-fous existants sont conservés : `isPrefetchRequest` (pas d'enregistrement sur prefetch),
mode `preview` admin (aucun enregistrement). Le middleware ne pose le cookie que si un UTM est
présent dans la query, donc les liens de preview (sans UTM) ne le polluent pas.

## Dashboards

- **`/admin/r/[slug]`** — nouvelle section « Sources » : tableau par `source` avec impressions gate,
  vues, et utilisateurs débloqués (acquisition). Sous-lignes par `campaign` quand plusieurs campagnes
  partagent une source.
- **`/admin`** — nouveau panneau « Top sources » (toutes ressources) : `source` → utilisateurs gagnés
  (nombre de subscriptions) + vues, trié par utilisateurs gagnés. Répond directement à « quelles
  sources m'ont ramené le plus d'utilisateurs ». La liste des ressources affiche aussi un compteur
  d'utilisateurs (subscribers) par ressource, pour « quelles ressources m'ont ramené le plus d'utilisateurs ».
- **MCP `get_stats`** — `getResourceStats` et `getStatsOverview` renvoient les ventilations ci-dessus ;
  la description de l'outil est mise à jour. Aucun nouvel outil.

## Découpage du code

- `lib/tracking/ref.ts` (nouveau, logique pure, testé) : `parseRefFromParams(URLSearchParams)` →
  `{ source, medium, campaign } | null` (gère l'alias `src`, normalise) ; `serializeRefCookie` /
  `parseRefCookie` ; constantes (nom du cookie, maxAge).
- `middleware.ts` (nouveau) : pose du cookie first-touch.
- `lib/stats/record.ts` : `recordGateView` / `recordPageView` acceptent un `ref` optionnel.
- `lib/content/queries.ts` : `addSubscription` accepte un `ref` optionnel (figé à l'insert).
- `app/(public)/r/[slug]/render.tsx` : lecture du cookie, transmission du `ref`.
- `lib/stats/aggregate.ts` (logique pure, testé) : `aggregateBySource(events)` →
  ventilation source/campagne ; agrégation d'acquisition à partir des subscriptions.
- `lib/stats/queries.ts` : enrichit `getResourceStats` (ventilation trafic + acquisition) et
  `getStatsOverview` (top sources global + subscribers par ressource).
- `app/admin/r/[slug]/page.tsx`, `app/admin/page.tsx` : rendu des nouvelles sections.

## Tests

Vitest sur la logique pure (cohérent avec le projet) :

- `lib/tracking/ref.ts` : parsing UTM + alias `src`, normalisation (casse, trim, longueur),
  valeurs absentes/vides, aller-retour cookie sérialisé.
- `lib/stats/aggregate.ts` : ventilation par source/campagne, comptage d'acquisition, événements
  sans source (bucket « direct/inconnu »).

Vérification finale : `npm run typecheck`, `npm run lint`, `npm test`. Les sections « Sources » des
dashboards affichent un état vide gracieux tant qu'aucun événement tagué n'existe ; la vérification
visuelle insère quelques `view_events` synthétiques dans la base locale pour contrôler le rendu peuplé,
sans modifier le seed.

## Hors périmètre

- Générateur de liens tagués dans l'admin (constructeur d'URL UTM) — saisie manuelle suffisante pour v1.
- `utm_term` / `utm_content`.
- Graphes / séries temporelles (backlog « Dashboard stats visuel »).
