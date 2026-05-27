# Lot 10 — Ancres de sections exposées à l'agent

## Contexte

Les titres `##`/`###` des modules markdown/callout reçoivent une ancre générée par
github-slugger (rehype-slug au rendu, `extractToc` pour le sommaire). C'est déterministe mais
l'agent IA ne connaît pas la transformation (accents retirés, minuscules, espaces → tirets), il
ne peut donc pas construire de liens `#ancre` fiables vers des sous-sections (ex. « mettre sur
la home des liens vers toutes les sections »).

## Objectif

L'agent obtient, via le MCP, la liste des sections de chaque page avec leur **ancre** et un
**href prêt à coller** (`/r/<slug>/<chemin>#<ancre>`), calculés exactement comme le rendu. Il
n'a plus à deviner la transformation.

## Périmètre

- Fonction pure `extractSections(mdTexts)` (réutilise `extractToc`, ancres par-module comme le
  sommaire actuel).
- `getResource` : chaque page renvoie `sections: { title, depth, anchor, href }[]`.
- Nouvel outil MCP `get_outline(slug)` : carte compacte de toutes les pages + sections + hrefs,
  sans le contenu des modules.

Hors lot : ancres page-scoped uniques (refonte du rendu), ancres pour les titres dans
accordion/steps/comparison (le sommaire ne couvre que markdown/callout), réécriture des liens.

## Détails

### Calcul des sections (pur)

`lib/content/toc.ts` : ajouter
```ts
extractSections(mdTexts: string[]): { title: string; depth: 2 | 3; anchor: string }[]
```
= pour chaque texte markdown, `extractToc` (slugger par module, identique au rendu), aplati.
Cohérent avec le sommaire affiché (`render.tsx` fait déjà `flatMap(extractToc)` par module).

### Href

Lien **relatif** intra-site : `/r/<slug>` pour la racine, `/r/<slug>/<chemin>` pour une
sous-page, suffixé de `#<anchor>`. (Relatif = fonctionne en dev et prod, idéal pour des liens
internes dans du markdown.)

### `getResource` (service)

Dans le parcours d'arbre (`toNode`), pour chaque page : collecter les `md` des modules
`markdown`/`callout`, appeler `extractSections`, mapper en
`{ title, depth, anchor, href }` (href = lien de la page + `#anchor`), et ajouter le champ
`sections` au nœud (à côté de `modules`, `children`).

### `get_outline(slug)` (MCP + service)

`service.getOutline(slug)` → `{ slug, title, url, pages: [{ title, path, url, sections: [{ title, anchor, href }] }] }`.
Parcourt l'arbre, calcule les sections par page, **sans** le contenu des modules. Outil MCP
`get_outline` `{ slug }` → renvoie cette carte. Idéal pour « liste-moi tous les liens » sans
tirer tout le contenu.

### `get_resource`

Inchangé dans sa forme, mais chaque page porte désormais `sections`. Description mise à jour
pour le signaler.

## Tests

Vitest (pur) : `extractSections` — plusieurs textes markdown → sections aplaties avec ancres
(et ancres = celles d'`extractToc`).

Vérification : `get_outline` sur une ressource seedée renvoie les sections avec des hrefs
`/r/<slug>[/<chemin>]#<ancre>` qui correspondent aux ancres rendues.

## Critères d'acceptation

1. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` passent.
2. `get_resource` renvoie `sections` par page ; `get_outline` renvoie la carte compacte.
3. Les `href` exposés correspondent aux ancres réellement rendues dans le reader.
4. Déployé (aucune migration).
