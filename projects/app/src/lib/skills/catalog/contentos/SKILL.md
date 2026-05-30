---
name: contentos
description: Produire un contenu éditorial de bout en bout avec la suite Contentos. Déclencher quand l'utilisateur veut écrire un post (LinkedIn aujourd'hui), partir d'une idée, ou mettre au propre un brouillon dans sa voix. Contentos est un outil pour agent : toute l'intelligence rédactionnelle est ici, dans l'agent ; Contentos stocke l'état (voix, formats de publication, posts) et l'expose via les outils MCP de la suite.
---

# contentos

Squelette du workflow de rédaction piloté par l'agent. On ne détaille pas encore chaque
sous-étape (itération ultérieure) — c'est la **séquence** qui compte.

## Outils MCP utilisés

- `list_voices` — voix éditoriales (gérées dans l'espace Compte, partagées dans la suite).
- `list_publication_formats` — formats de publication : `structure`, `visualIntent`
  (intention de visuel) et `writingRules` (cosmétique). Liés à une plateforme (`linkedin`).
- `create_post` / `get_post` / `edit_post` — poser et amender le post.
- (Plus tard, partie visuel : `generate_image`, `render_template`, `attach_media_to_post`…)

## Séquence

1. **Brainstorm de l'idée** avec l'humain : cerner le sujet, l'angle, la matière.
2. **Cadre de publication** : choisir la **plateforme**, le **format**
   (`list_publication_formats`) et la **voix** (`list_voices`). Demander à l'humain si
   le choix est ambigu.
3. **Plan / déroulé** : construire le plan du post en respectant la `structure` du format.
   Faire valider le déroulé à l'humain.
4. **Fond** : rédiger le contenu selon le plan validé. On vise le fond juste, pas encore
   le style.
5. **Voix** : réécrire le texte dans la voix choisie. **Itérer** jusqu'à ce que la voix
   soit vraiment satisfaisante (aller-retour avec l'humain).
6. **Cosmétique** : appliquer les `writingRules` du format (emojis, hashtags, puces,
   règles de mise en page) pour la finalisation.
7. **Poser le post** : `create_post` → le post est prêt à être publié (l'humain valide,
   planifie ou publie depuis Contentos).
8. **Visuel** (étape ultérieure, hors de ce squelette) : à partir du `visualIntent` du
   format, produire le visuel d'accompagnement avec les outils média.

## Principe

L'agent porte la méthode et le jugement éditorial. Contentos ne « pense » pas : il garde
la voix, les formats et les posts, et les expose. Les spécificités de format vivent dans
le format de publication chargé, pas en dur dans ce skill.
