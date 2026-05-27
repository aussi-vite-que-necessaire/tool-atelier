# media — centre des médias (migration depuis ContentOS) — design

- **Date** : 2026-05-27
- **Statut** : validé (brainstorming), à transformer en plan d'implémentation
- **Projet** : `media` (atelier)
- **Prérequis** : `media` v1 en service (génération/édition Gemini, rendu HTML→image, store R2 + Postgres, MCP + `/v1`). Cf. `2026-05-27-media-import-design.md`.

## 1. Objectif

`media` devient le **centre unique des médias** de la suite de contenu : génération/édition
d'image, rendu HTML→image, **templates visuels** (HTML/CSS paramétrés), **catalogue de styles**
de génération, **chartes graphiques** (style guides), **construction de PDF** à partir d'images, et
**upload** d'images / PDF / vidéos. Toute cette logique vit chez `media` et s'expose par **MCP**
(connecteur claude.ai) et par l'**API `/v1`** service-to-service.

ContentOS conserve ses propres copies de ces capacités pour l'instant : il n'est **pas touché** par
ce chantier. Sa simplification (retrait de sa logique média au profit de `media`) fera l'objet d'un
incrément ultérieur.

## 2. Périmètre

**Dans ce chantier :**

- **Modèle d'objet généralisé** : table `media` (image / video / pdf / render) en remplacement de
  `images`. `store()` reste l'unique écrivain pour tous les types.
- **Visual templates** : templates Handlebars (HTML + CSS), schéma de variables typées, valeurs
  d'exemple, contexte de marque, lien vers une charte. Compilation côté serveur + rendu en image.
- **Visual styles** : catalogue de styles de génération (un nom + un prompt), appliqués à la
  génération d'image via `style_id`.
- **Style guides** : fiches markdown de charte graphique, référencées par les templates.
- **Brand** : réglages de marque uniques et globaux (nom, signature, logo).
- **PDF** : construction d'un PDF à partir d'une liste ordonnée d'images (une image par page) +
  upload de PDF existant.
- **Vidéo** : upload/stockage (mp4).
- **Interfaces d'admin** : petites pages sobres derrière le login (gestion des catalogues, aperçu de
  rendu, galerie + upload manuel).

**Hors périmètre (incréments ultérieurs) :** génération vidéo par IA, multi-marque, import des
données historiques de ContentOS, simplification de ContentOS lui-même, catalogage/labellisation
avancés.

## 3. Décisions d'architecture

| Sujet | Décision | Raison |
|---|---|---|
| Réutilisation | **Lift-and-port adapté** depuis ContentOS | Code éprouvé, iso-fonctionnel, rapide ; la seule adaptation est de remplacer l'appel HTTP au moteur média distant par un appel interne (`media` est le moteur) |
| Synchronicité | **Pas de worker** ; tout synchrone | browserless gère déjà la file de rendu ; PDF et upload ne sont que des octets |
| Modèle d'objet | Table **`media`** avec `kind` | Nommage propre pour vidéo/PDF, évolutif ; généralise `images` |
| Marque | **Marque unique** (ligne globale) | Simplicité ; multi-marque possible plus tard sans casser |
| PDF | **Générique** : liste d'images ordonnée → PDF | Réutilisable hors LinkedIn ; pas de modèle « carrousel » spécifique |
| Templating | **Handlebars + DSL** portés tels quels | Comportement déjà éprouvé dans ContentOS |
| Contrat `/v1` | **Additif uniquement** | ContentOS consomme `/v1` ; ne rien casser |

## 4. Modèle de données (Drizzle / Postgres)

### Table `media` (remplace `images`)

| Colonne | Type | Note |
|---|---|---|
| `id` | text PK | nanoid 12 |
| `r2_key` | text | ex. `images/abc123.png` |
| `url` | text | URL publique R2 |
| `kind` | text | `image \| video \| pdf \| render` |
| `mime` | text | type MIME des octets stockés |
| `prompt` | text null | génération/édition ; null sinon |
| `parent_id` | text null | édition → référence `media.id` |
| `source` | text | `gemini_generate \| gemini_edit \| html_render \| template_render \| upload \| pdf_aggregate` |
| `template_id` | text null | rendu de template → référence `visual_templates.id` |
| `vars` | jsonb null | variables utilisées pour un rendu de template |
| `style_id` | text null | style appliqué à une génération |
| `tags` | jsonb | tableau de tags |
| `width` | int null | |
| `height` | int null | |
| `size_bytes` | int null | taille des octets stockés |
| `created_at` | timestamptz | |

Index : `created_at desc`, `parent_id`, `source`, `kind`.

**Migration** : renommer `images` → `media` et ajouter les colonnes. La preview démarre sur une base
fraîche ; le renommage préserve les lignes existantes pour le merge prod ultérieur.

### Table `visual_styles`

`id` (text PK), `name` (text), `prompt` (text), `created_at`, `updated_at`.

### Table `style_guides`

`id` (text PK), `name` (text), `content` (text, markdown), `created_at`, `updated_at`.

### Table `visual_templates`

`id` (text PK), `slug` (text, unique), `label` (text), `platform` (text, défaut `linkedin`),
`width` (int), `height` (int), `body_html` (text, Handlebars), `css` (text, Handlebars),
`variables_schema` (jsonb), `sample_vars` (jsonb), `style_guide_id` (text null, FK
`style_guides.id`), `created_at`, `updated_at`.

### Table `brand` (ligne unique)

`id` (text PK, valeur fixe), `name` (text), `signature` (text), `logo_url` (text null),
`updated_at`.

## 5. Templating (porté de ContentOS)

- **DSL de variables** (`templates/dsl.ts`) : types `string | image | list | color`, validés par
  zod ; `fillVarDefaults()` complète les manquants ; `variablesSchemaToZod()` génère le validateur
  runtime.
- **Compilation** (`templates/compile.ts`) : Handlebars (helpers `escape`, `trim`, `ifNotEmpty`),
  `base.css` chargé une fois, cache LRU par contenu source. `compile(template, vars, brand)` →
  chaîne HTML autonome.
- **Contexte de marque** (`templates/brand.ts`) : injecte `{{brand.name}}`, `{{brand.signature}}`,
  `{{brand.logo}}` depuis la table `brand`.
- **Rendu** : `compile` → `renderHtml({ html, width, height })` (module existant) →
  `store({ kind: "render", source: "template_render", template_id, vars })`.

Le rendu HTML brut (`render_html`) reste disponible pour les appelants qui fournissent tout le HTML.
`render_template` est le chemin paramétré.

## 6. Styles & PDF

- **Styles** : `generate_image` (MCP) et `/v1/generate` acceptent un `style_id` optionnel, résolu
  côté serveur en son `prompt` puis composé (`${prompt}\n\nStyle: ${stylePrompt}`). `/v1` conserve
  le passthrough `stylePrompt` existant (rétro-compatible).
- **PDF** (`pdf/build.ts`, pdf-lib) : `buildPdf(images)` — une image par page, format reniflé aux
  octets (PNG/JPEG). `create_pdf` prend une liste ordonnée d'ids d'images (`kind: image`), télécharge
  les octets depuis R2, construit le PDF, `store({ kind: "pdf", source: "pdf_aggregate" })`.
- **Upload PDF/vidéo** : via `/v1/upload` (octets bruts + `Content-Type`) et la galerie UI ; `kind`
  déduit du MIME. Validation : image ≤ 10 Mo (png/jpeg/webp), pdf ≤ 100 Mo, vidéo mp4 ≤ 500 Mo.

## 7. Interfaces

### MCP (ajouts au connecteur existant)

Réorganisation des outils en `lib/mcp/tools/*.ts` (fichiers focalisés). Outils ajoutés :

- **Templates** : `list_visual_templates`, `get_visual_template`, `create_visual_template`,
  `update_visual_template`, `delete_visual_template`, `render_template` (templateId + vars → image).
- **Styles** : `list_visual_styles`, `create_visual_style`, `update_visual_style`,
  `delete_visual_style`.
- **Style guides** : `list_style_guides`, `get_style_guide`, `create_style_guide`,
  `update_style_guide`, `delete_style_guide`.
- **Brand** : `get_brand`, `update_brand`.
- **PDF** : `create_pdf`.
- `generate_image` gagne `style_id` (optionnel).

Les 6 outils existants (`generate_image`, `edit_image`, `render_html`, `list_images`, `get_image`,
`delete_image`) conservent leurs noms et leur comportement.

### API `/v1` (additive — routes existantes inchangées)

- `POST /v1/render-template` — `{ templateId, vars }` → `{ id, url, width, height }`.
- `POST /v1/pdf` — `{ imageIds: string[] }` → `{ id, url }`.
- `POST /v1/generate` accepte en plus `styleId` (optionnel, résolu côté serveur).

La gestion des catalogues (CRUD templates/styles/guides/brand) reste MCP + UI : les services
consomment la **production** de médias, pas l'administration des catalogues.

### Front-end d'admin (App Router, derrière le login mono-utilisateur)

Pages sobres en Tailwind, fonctionnelles, sans recherche esthétique :

- **Styles** : liste / créer / éditer (nom + prompt).
- **Style guides** : liste / créer / éditer (nom + markdown).
- **Templates** : liste / créer / éditer (HTML + CSS + schéma de variables + sample vars + charte
  liée) avec **aperçu du rendu** en image.
- **Brand** : réglages de marque.
- **Galerie** : parcourir les objets `media` (filtre par `kind`), **upload manuel**
  (image/PDF/vidéo), visualiser, supprimer.

Les server actions réutilisent les mêmes modules internes (`store`, repositories, `compile`,
`renderHtml`).

## 8. Authentification & secrets

- **Aucun nouveau secret.** Login UI = BetterAuth mono-utilisateur existant ; `/v1` = Bearer
  `MEDIA_ENGINE_SERVICE_KEY` existant ; MCP = connecteur OAuth existant.
- **Nouvelles dépendances** : `handlebars`, `pdf-lib`.

## 9. Tests

- **Logique pure (vitest)** : `dsl` (parsing/validation/defaults), `compile` (sortie HTML
  Handlebars), `pdf/build` (octets → PDF valide), composition de style, repositories (via
  `db:test:prepare` existant).
- **Portage** : reprendre les tests ContentOS pertinents (templates, carousel/pdf).
- **Runtime** (browserless, Gemini, R2) : vérifié sur la **preview déployée**, sans mock.

## 10. Seed

`seed.mjs` : une marque par défaut, 1–2 styles visuels (ex. « 3D doux », « Flat 2D »), une charte,
1–2 templates (LinkedIn horizontal/carré portés de ContentOS) — pour que la preview montre du
contenu immédiatement.

## 11. Mise en service

1. Implémenter sur la branche `work/media-migration-contentos`.
2. Déployer en **preview** `https://media-<branche>.lab.avqn.ch` et valider (MCP + `/v1` + UI).
3. Merge PR → prod `media.lab.avqn.ch` (la migration `images`→`media` s'applique aux lignes prod).

## 12. Risques / points ouverts

- **Renommage `images`→`media` en prod** : vérifier que la migration Drizzle génère bien un `ALTER
  TABLE ... RENAME` (et non drop/create) pour préserver les lignes existantes ; corriger le SQL si
  besoin.
- **Taille des uploads** : `/v1/upload` lit le corps en mémoire ; valider que les limites Next/Caddy
  tolèrent 500 Mo (vidéo). Si blocage, ajuster la config plutôt que de changer le modèle.
- **Cohérence catalogues media ↔ ContentOS** : deux copies coexistent pendant la transition, c'est
  attendu ; la réunification se fera à la simplification de ContentOS.
