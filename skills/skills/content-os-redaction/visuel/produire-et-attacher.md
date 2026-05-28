# produire-et-attacher

Produire l'image si besoin, rendre le visuel et l'attacher au post. Le `postId` vient de `create_post` (étape 4 du SKILL).

## Obtenir le mediaId de l'image (habillages b et c)

Deux sources :

- **Générer** : `list_visual_styles` pour choisir un style cohérent (chaque style porte un `id`, un `name` et un `prompt` de rendu) → `generate_image(prompt, aspectRatio?, styleId?)` (seul `prompt` est requis). Le `prompt` décrit la scène ; le style porte le rendu. Récupérer le `mediaId` renvoyé.
- **Réutiliser** : `list_gallery_images` → reprendre le `mediaId` d'une image existante.

Pour retoucher une image plutôt que repartir de zéro : `edit_image(sourceMediaId, prompt)`.

## Rendre et attacher selon l'habillage

- (a) **carte texte** : `render_visual(templateId, vars, postId)` — rend le template et l'attache au post.
- (b) **template + image** : injecter le `mediaId` dans la variable `image` du template, puis `render_visual(templateId, vars, postId)`.
- (c) **image nue** : `attach_media_to_post(postId, mediaId)`.

`render_visual` attache lui-même son résultat ; `attach_media_to_post` attache une image directement. Un post porte un seul visuel : `detach_media(postId)` avant d'en attacher un autre si on remplace.

## Principes de forme visuelle LinkedIn

Valables pour tout visuel, indépendamment du template :

- **Format portrait 4:5 (1080×1350)** : il occupe le plus de hauteur dans le feed mobile. Défaut pour une image générée si rien n'impose un autre ratio.
- **Une seule idée par visuel** : pas de paragraphe dans une image. Si le message demande plusieurs idées, c'est le signe qu'il faut plusieurs visuels ou rester en texte.
- **Lisible au pouce** : texte large, contraste fort, peu de mots.
- **Cohérent avec le ton du post** : le visuel prolonge la voix, il ne la contredit pas.

## Validation

Montrer le visuel rendu à Manu avant de considérer le post fini. S'il ajuste, reprendre à l'étape concernée (autre template, autre image, variables retouchées).
