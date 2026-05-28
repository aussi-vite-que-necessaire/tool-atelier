# Relecture finale (phase 4)

Après création, relis la ressource avec `get_resource` (contenu) et `get_outline`
(structure + sommaire), puis vérifie chaque point. Corrige avant de proposer la
publication.

## Cohérence avec le plan

- [ ] Toutes les pages prévues au plan validé existent, avec les bons titres.
- [ ] L'arborescence (hiérarchie, ordre des pages) correspond au plan. Sinon :
      `reorder_pages` / `move_page`.
- [ ] Chaque page contient bien les modules prévus, dans l'ordre voulu. Sinon :
      `reorder_modules` / `add_modules` / `update_module`.

## Complétude

- [ ] Aucune page vide (au moins un module utile par page).
- [ ] Aucun module au contenu placeholder, tronqué ou incohérent.
- [ ] Les liens, URLs d'image, d'embed et de fichier sont plausibles et valides.
- [ ] Au moins un point d'entrée clair (intro sur la page racine) et, pour un lead magnet,
      un `cta` final.

## Sommaire & structure

- [ ] Les titres `##`/`###` produisent un sommaire lisible (vérifier `get_outline`).
- [ ] Hiérarchie des titres cohérente (pas de `###` sans `##` parent).
- [ ] Le `slug` de la ressource est court, propre, sans accents ni espaces.

## Métadonnées

- [ ] `title` et `description` clairs et vendeurs.
- [ ] **Cover** présente (`coverImageUrl`) — ou absence assumée avec l'utilisateur.
- [ ] `visibility` correcte ; si `private`, les accès sont accordés (`grant_access`).
- [ ] `published: false` tant que la publication n'a pas été validée.

## Clôture

- [ ] Donner l'URL finale `/r/<slug>` et un récap de la structure.
- [ ] Proposer les ajustements éventuels.
- [ ] **Proposer de publier** ; ne passer `published: true` qu'après accord explicite.
