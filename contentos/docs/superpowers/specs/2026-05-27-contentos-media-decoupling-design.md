# ContentOS — découplage média (consommateur de `media`) — design

- **Date** : 2026-05-27
- **Statut** : validé (brainstorming), à transformer en plan d'implémentation
- **Projets** : `contentos` (principal) + `media` (petite API lecture)
- **Contexte** : `media` (https://media.lab.avqn.ch) est désormais le centre des médias (génération, édition, templates, styles, chartes, PDF, upload). Cf. `media/docs/superpowers/specs/2026-05-27-media-migration-contentos-design.md`.

## 1. Objectif

ContentOS **ne crée plus aucun média** : ni génération, ni édition, ni rendu de template, ni
construction de PDF, ni upload. Un post **référence** un média qui vit dans le service `media`. Pour
en attacher un : un **picker** (UI) ou l'outil **MCP** `attach_media_to_post`. La publication
LinkedIn récupère les octets depuis l'**URL publique** du média.

## 2. Périmètre

**Dans ce chantier :**
- `media` : petite **API lecture `/v1`** (liste + get) pour alimenter le picker (service-to-service).
- `contentos` : suppression de toute la logique média (génération/templates/styles/chartes/PDF/upload),
  référence média par **colonnes sur le post**, picker UI, outils MCP réduits à `attach_media_to_post` +
  `detach_media`, repointage de `MEDIA_ENGINE_URL` vers `media.lab.avqn.ch`, migration des références
  existantes, publication LinkedIn via fetch de l'URL.

**Hors périmètre :** tout ce qui n'est pas média dans ContentOS (édition, planning, voix, LinkedIn
hors média). La catégorisation/dossiers des médias dans le picker (amélioration future). La prod réelle
`contentos.avqn.ch` (seule la copie lab est touchée).

## 3. Décisions d'architecture

| Sujet | Décision | Raison |
|---|---|---|
| Référence média | **Colonnes sur le post** | ContentOS n'a plus de tables média ; un post porte sa référence |
| Picker | **API lecture `/v1` sur media** | Galerie navigable service-to-service (service-key) |
| Outil MCP d'attache | **Agnostique** : `media_id` **ou** `media_url` | Attacher un média du service ou n'importe quelle URL |
| Données lab | **Migration des références** | Préserver les médias déjà attachés aux posts |
| Marque | **Suppression de `settings`** | La marque vit dans media ; `settings` ne contenait que la marque |
| Publication | **fetch de l'URL publique** | Plus de client moteur média ; les octets viennent de l'URL R2 |

## 4. Modèle de données (ContentOS)

### Colonnes ajoutées à `posts`
`media_id` (text null — id côté service media), `media_url` (text null), `media_kind`
(text null — `image|video|pdf|render`), `media_width` (int null), `media_height` (int null).
Un seul média par post (modèle actuel conservé). La colonne `media_id` (FK vers l'ancienne table)
est retirée.

### Tables supprimées
`media`, `image_assets`, `carousel_slides`, `visual_templates`, `visual_styles`, `style_guides`,
`settings`. Les enums `media_kind` / `image_source` locaux.

### Migration de données (avant suppression)
Pour chaque post lié : copier `media.asset_key → posts.media_url`, `media.kind → posts.media_kind`
(`carousel → pdf`), `media.width/height → posts.media_width/height`. `posts.media_id` reste **null**
pour l'existant (ces médias vivent sur l'ancien stockage Cloudflare ; leurs URLs publiques restent
valides pour l'affichage et la publication). Puis dropper les tables.

## 5. media — API lecture `/v1` (service-to-service)

Ajout côté `media` (PR séparée, déployée en premier). Auth Bearer `MEDIA_ENGINE_SERVICE_KEY`.

- `GET /v1/media` — paramètres : `q` (recherche texte sur prompt + tags), `kind`
  (`image|video|pdf|render`), `tag`, `orientation` (`landscape|portrait|square`), `limit`
  (défaut 30, max 100), `offset`. Tri **du plus récent au plus ancien**. Réponse :
  `{ items: [{ id, url, kind, width, height, prompt, tags, created_at }], total, limit, offset }`.
- `GET /v1/media/:id` — l'objet ou 404.

Le repository `listMediaRecords` gagne `offset` (pagination) et un filtre `orientation` (dérivé de
`width`/`height`). `q` couvre `prompt` (ilike) et `tags`.

## 6. Interfaces (ContentOS)

### MCP
Ne restent que deux outils média :
- `attach_media_to_post` { `post_id`, **`media_id?`** , **`media_url?`** } — au moins l'un des deux.
  Si `media_id` : résout via `GET /v1/media/:id` (url, kind, dims). Si `media_url` : utilise l'URL
  telle quelle ; `kind` déduit de l'extension/mime (défaut `image`), dims optionnelles. Écrit les
  colonnes du post. Renvoie le post mis à jour.
- `detach_media` { `post_id` } — remet les colonnes média à null.

Tous les autres outils média de ContentOS sont supprimés (`generate_image`, `edit_image`,
`render_visual`, `list_gallery_images`, templates, styles, chartes).

### Front-end
Dans l'éditeur de post : un bouton **« Choisir un média »** ouvre un **picker** (modal) qui liste les
médias via un server action → `GET /v1/media`. Le picker offre : recherche texte, filtre par type,
filtre par tag, filtre par orientation, **pagination** (charger plus / pages), grille de vignettes du
plus récent au plus ancien. Sélection → attache (colonnes du post). Bouton **« Détacher »**. Aucune
UI de création/upload/template/style/charte ne subsiste.

### Publication LinkedIn
Le worker `publish-linkedin` récupère les octets par **`fetch(media_url)`** (remplace
`getMediaEngine().download`). Mapping `media_kind → LinkedIn` : `pdf → document`, `video → video`,
`image|render → image`. Le snapshot de publication (`snapshotKeys`, `mediaKind`) lit les colonnes
média du post.

## 7. Suppressions de code (ContentOS)

- `src/lib/media-engine/` (client HTTP + stubs in-memory/filesystem) → remplacé par un mini
  `media-catalog` (client lecture `/v1/media`) + un `fetchBytes(url)` pour la publication.
- `src/lib/visual-templates/`, `src/lib/carousel/`, `src/lib/ai/generate-image.ts`,
  `src/lib/media/` (upload cores, validate-upload).
- Queues BullMQ `generate-image` et `render-visual` (worker garde `publish-linkedin` + `dummy`) ;
  retrait de leur enregistrement (`src/worker/index.ts`) et de leurs enqueue (`src/lib/queue/`).
- Outils MCP supprimés (cf. §6) + repositories des tables supprimées.
- Pages UI : éditeur de templates, galerie de génération, styles, chartes, upload, et la route
  `/api/media-stub`.
- `settings` (table + repository + usage marque) et le module `brand` des templates.

## 8. Repointage & séquencement

- Secret `MEDIA_ENGINE_URL` (scope `contentos`, `/lab-secret`) → `https://media.lab.avqn.ch` ;
  `MEDIA_ENGINE_SERVICE_KEY` aligné sur celui de `media`. Ces deux variables restent ; le reste de la
  conf média (stubs, etc.) part.
- **Ordre des PR :**
  1. **media** — API lecture `/v1` (§5). Branche → preview → validation → merge prod.
  2. **contentos** — découplage complet (§4, §6, §7), consommant `media` **prod**. Branche → preview
     → validation → merge.

## 9. Tests

- **ContentOS (logique pure, vitest)** : mapping `media_kind → LinkedIn`, le client `media-catalog`
  (parsing des réponses `/v1/media`), la résolution d'attache (`media_id` vs `media_url`, déduction
  du kind depuis l'URL). Mettre à jour/retirer les tests des modules supprimés.
- **media (vitest)** : routeur `/v1` lecture (filtres, pagination, orientation), repository `offset`.
- **Runtime** (picker, attache, publication) : validé sur la preview ContentOS pointant sur media prod.

## 10. Risques / points ouverts

- **URLs Cloudflare héritées** : les posts migrés gardent des URLs R2 Cloudflare (bucket partagé,
  toujours public) — affichage et publication OK. Pas de `media_id` résolvable pour ces entrées (null).
- **Pas de champ « nom »** sur les objets media aujourd'hui : la recherche du picker couvre prompt +
  tags. Un nom/titre et la catégorisation sont des améliorations futures.
- **Limite de taille des server actions** : le picker ne fait que lister (pas d'upload) → pas de
  contrainte de taille côté ContentOS.
