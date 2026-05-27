# Outils du MCP `avqn_res`

Tous les outils sont réservés à l'admin (le MCP gère l'authentification). Les chemins de
page (`path`, `parentPath`) sont des **tableaux de slugs** depuis la racine : `[]` = page
racine, `["chapitre-1"]` = sous-page, `["chapitre-1", "section-a"]` = plus profond. La page
racine a un slug vide (`""`) et ne peut pas être supprimée ; son slug est immuable.

## Stratégie de création

- **Petite/moyenne ressource** : tout en **un seul** `create_resource` (`rootModules` +
  `pages[]` imbriquées avec leurs `modules` et `children`).
- **Grosse ressource** : `create_resource` pour la coquille (titre + page racine légère),
  puis **un appel `add_page` par page** (avec ses modules). Évite un payload géant.
- Pour compléter une page existante : `add_modules` (ajoute à la **fin** de la page).

## Ressource

| Outil | Paramètres | Retour |
| --- | --- | --- |
| `list_resources` | — | `[{ slug, title, visibility, published, featured }]` |
| `get_resource` | `{ slug }` | Arbre complet : pages par chemin, modules par id, sections (ancre + href) |
| `get_outline` | `{ slug }` | Structure + sommaire (titres/ancres/href), **sans** le contenu des modules |
| `create_resource` | `{ title, slug?, description?, visibility?, featured?, published?, rootTitle?, rootModules?[], pages?[] }` | `{ id, slug, url }` |
| `update_resource` | `{ slug, patch: { title?, description?, coverImageUrl?, visibility?, featured?, published? } }` | `{ slug, url }` |
| `delete_resource` | `{ slug }` | `{ ok: true }` (cascade pages + modules) |

- `slug` est auto-généré depuis `title` s'il est omis. `rootTitle` vaut `title` par défaut.
- `visibility` ∈ `public` \| `private`. `coverImageUrl` = URL publique valide.
- **Page (objet `pages[]`)** : `{ slug, title, modules?[], children?[] }` — `children`
  récursif.

## Pages

| Outil | Paramètres | Retour / note |
| --- | --- | --- |
| `add_page` | `{ resourceSlug, slug, title, parentPath?[], position?, modules?[] }` | `{ path[], moduleIds[] }`. `parentPath` vide = sous la racine. |
| `add_modules` | `{ resourceSlug, path[], modules[] }` | `{ moduleIds[] }`. Ajoute à la **fin** de la page. |
| `update_page` | `{ resourceSlug, path[], patch: { title?, slug? } }` | Le slug racine ne change pas. |
| `delete_page` | `{ resourceSlug, path[] }` | `{ ok: true }`. Pas la racine. Cascade modules. |
| `move_page` | `{ resourceSlug, path[], newParentPath?[], position? }` | Déplace (vide = racine). Pas la racine. |
| `reorder_pages` | `{ orderedPageIds[] }` | Réordonne des pages **de même parent** (ids via `get_resource`). |

## Modules

| Outil | Paramètres | Retour / note |
| --- | --- | --- |
| `add_module` | `{ resourceSlug, path[], module, position? }` | `{ id }`. `position` auto-incrémentée si omise. |
| `update_module` | `{ id, content?, position? }` | Le `content` est re-validé selon le type du module. |
| `delete_module` | `{ id }` | `{ ok: true }`. |
| `reorder_modules` | `{ orderedModuleIds[] }` | Position = index dans la liste fournie. |

(Shape exacte de `module` / `modules[]` : voir `modules.md`.)

## Accès, diffusion & stats

| Outil | Paramètres | Note |
| --- | --- | --- |
| `grant_access` | `{ resourceSlug, email }` | Autorise un email sur une ressource **privée**. |
| `revoke_access` | `{ resourceSlug, email }` | Retire l'accès d'un email. |
| `tracking_link` | `{ slug, source, medium?, campaign?, path? }` | Lien de partage tagué UTM (provenance). `source` = plateforme, `campaign` = post précis. Voir `liens-tracking.md`. Renvoie `{ url }`. |
| `get_stats` | `{ slug?, sinceDays? }` | Avec `slug` : détail d'une ressource (dont ventilation par source). Sans : vue d'ensemble + top sources. |
