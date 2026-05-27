# Lot 8 — Bulk MCP granulaire (création page par page)

## Contexte

`create_resource` (lot 3) accepte toute l'arborescence en un appel, ce qui est parfait pour
une petite ressource mais ingérable pour une grosse : un agent a buté en voulant recréer une
ressource de 6 pages / 127 modules (~42 ko) en un seul payload. Les seuls outils d'édition
incrémentale sont unitaires (`add_page`, `add_module`) → des dizaines d'appels. Il manque une
granularité intermédiaire : **~1 appel par sous-page**, avec un payload borné.

## Objectif

L'agent bâtit une grosse ressource ainsi : `create_resource` crée la coquille (métadonnées +
page racine), puis **un appel par sous-page** qui crée la page avec ses modules
(`add_page` + `modules[]`), `parentPath` la plaçant dans l'arbre ; `add_modules` permet de
compléter une page (racine après création, ou découper une page très chargée en plusieurs
appels). Chaque appel reste petit.

## Périmètre

- `add_page` accepte un tableau `modules[]` (créer la page **et** ses modules en un appel).
- Nouvel outil `add_modules` (ajout d'un lot de modules à une page existante).
- `add_page` **n'accepte pas** de `children` (pas de sous-arbre) : c'est ce qui borne la taille
  de chaque appel ; les enfants se créent par appels séparés via `parentPath`.
- Descriptions MCP : guider l'agent (petite ressource → arbre complet dans `create_resource` ;
  grosse → coquille puis page par page).

Hors lot : pagination/streaming des appels, édition transactionnelle multi-pages, bulk de
suppression.

**Rien n'est cassé** : `create_resource` (arbre complet), `add_page`, `add_module`,
`reorder_modules`, `reorder_pages` restent inchangés dans leur forme actuelle ; `add_page`
gagne un champ optionnel.

## Modifications

### Couche service (`lib/resources/service.ts`)

- `addPage(input)` : champ optionnel `modules?: ModuleInput[]`. Après insertion de la page, si
  `modules` est fourni, insère ces modules (positions `0..n-1`), comme le fait déjà
  `createResource` pour une page planifiée. Retour inchangé (`{ path }`), enrichi de
  `moduleIds` (ids des modules créés, pour un éventuel réordre ultérieur).
- `addModules(input: { resourceSlug, path, modules: ModuleInput[] })` (nouveau) : résout la
  page, compte ses modules existants, insère les nouveaux **à la fin** (positions = `count + i`).
  Retour : `{ moduleIds }`.

### Façade MCP (`lib/resources/mcp.ts`)

- `add_page` : ajout du champ `modules?: Module[]` (validé par `moduleInputSchema`) ; description
  mise à jour (« crée une page **et** ses modules en un appel »).
- `add_modules` (nouveau) : `{ resourceSlug, path, modules: Module[] }` → `{ moduleIds }`.
- `create_resource` : description ajustée pour orienter petite vs grosse ressource.

Les schémas `moduleInputSchema` (lot 3) sont réutilisés tels quels.

## Tests

Logique pure limitée (l'insertion est en base). Vérification :

- Tests existants restent verts (`npm test`).
- Vérif MCP (smoke local) : `create_resource` coquille → `add_page` avec `modules[]` (page +
  modules créés, ordre correct) → `add_modules` (modules ajoutés à la fin) → `get_resource`
  reflète la structure. Payload de chaque appel borné à une page.

## Critères d'acceptation

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` passent.
2. `add_page` avec `modules[]` crée la page et ses modules dans l'ordre, en un appel.
3. `add_modules` ajoute un lot de modules à la fin d'une page existante.
4. `add_page` sans `children` (pas de sous-arbre) ; les sous-pages se créent via `parentPath`.
5. Les descriptions MCP orientent vers le bon outil selon la taille.
6. Déployé en prod (redéploiement Coolify ; pas de migration de schéma).
