# Exposer la construction de liens de tracking — design

Les agents pilotant la plateforme (via MCP `avqn_res`) et la skill `creer-une-ressource`
doivent pouvoir produire des liens de tracking UTM corrects sans deviner le format. La
plateforme possède déjà la capture first-touch (`[[tracking-utm]]`) ; ici on expose la
**construction** des liens du bon côté : là où une ressource expose son URL.

## Où le lien se crée aujourd'hui

`resourceUrl(slug)` (`lib/resources/service.ts`) construit l'URL publique `{base}/r/<slug>`.
Elle est renvoyée comme `url` par `create_resource`, `update_resource`, `get_resource` ;
`get_outline` donne les chemins de sous-pages. C'est le moment où l'agent tient un lien
partageable — donc le bon endroit pour lui apprendre à le taguer.

## Surface MCP

Outil **`tracking_link`** : `{ slug, source, medium?, campaign?, path? }` → `{ url }`,
l'URL absolue taguée. Garantit le bon domaine, les bons noms de paramètres et la même
normalisation que la capture (trim, minuscules, ≤ 64). `path` (tableau de slugs) cible une
sous-page ; défaut = page racine.

Les descriptions de `create_resource` et `get_resource` pointent vers `tracking_link` :
quand l'agent reçoit un `url`, il sait qu'il peut en dériver des liens de campagne.

Pourquoi un outil plutôt que de la doc seule : les liens construits à la main sont fragiles
(mauvais domaine, mauvaise casse, mauvais nom de paramètre). L'outil rend la méthode
actionnable et exacte, et son schéma documente lui-même les paramètres.

## Convention de paramètres (rappel, identique à la capture)

- `source` (= `utm_source`) — la plateforme : `linkedin`, `newsletter`, `twitter`.
- `campaign` (= `utm_campaign`) — le contenu précis : `post-automatisation`, `carrousel-mai`.
- `medium` (= `utm_medium`) — le canal : `social`, `email`.

Alias `?src=` accepté à la capture comme synonyme de `utm_source`. `source` est requis (le
tag minimal utile) ; `medium`/`campaign` optionnels.

## Découpage

- `lib/tracking/ref.ts` (logique pure, testée) : `buildTrackingUrl(baseUrl, { source, medium?, campaign? })`
  — ajoute les paramètres UTM normalisés à une URL de base ; réutilise la normalisation du parseur.
- `lib/resources/service.ts` : `trackingLink({ slug, path?, source, medium?, campaign? })` — valide
  que la ressource existe, compose l'URL absolue (`appBaseUrl` + `pagePath`), renvoie `{ url }`.
- `lib/resources/mcp.ts` : outil `tracking_link` ; descriptions de `create_resource`/`get_resource` enrichies.
- `skills/creer-une-ressource/` : `references/liens-tracking.md` (méthodologie + paramètres + exemples +
  appel `tracking_link`) ; SKILL.md (entrée dans la liste des références + étape de diffusion en phase 4) ;
  `references/outils-mcp.md` (ligne `tracking_link`).

## Tests

`buildTrackingUrl` (Vitest, logique pure) : ajout des trois paramètres, omission des absents,
normalisation (casse/longueur), préservation d'un chemin de sous-page, source requise.

Vérification : `npm run typecheck`, `npm run lint`, `npm test`, et un appel réel de `tracking_link`
en local pour confirmer une URL valide et round-trip avec le parseur.

## Hors périmètre

- Pas d'instructions au niveau serveur MCP (le handler n'en expose pas ; la découverte passe par
  les descriptions d'outils).
- Pas de raccourcisseur d'URL ni de QR codes.
